import { NextRequest, NextResponse } from "next/server";
import { createBridgeProvider, CHAIN_IDS, CHAIN_INFO, type ChainId } from "@/lib/providers/bridge-provider";
import { getConfig } from "@/lib/providers/clob-client";
import { accountManager } from "@/lib/account-manager";
import { accountStore } from "@/lib/account-store";

export const dynamic = "force-dynamic";

// GET /api/bridge - Get bridge info
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");

  try {
    const config = getConfig();
    const activeAccount = await accountStore.getActiveAccount();
    const walletAddress = config.walletAddress || activeAccount?.walletAddress || null

    if (!walletAddress) {
      return NextResponse.json(
        { error: "No wallet connected. Please connect your wallet first." },
        { status: 400 }
      );
    }

    const bridge = createBridgeProvider(walletAddress);

    switch (action) {
      case "assets":
        // Get supported assets
        const assets = await bridge.getSupportedAssets();
        return NextResponse.json({ success: true, assets });

      case "deposit":
        // Get deposit addresses via CLI wrapper
        let cliAddresses;
        try {
          cliAddresses = await accountManager.getDepositInfo();
        } catch (e) {
          // Fallback to old provider if CLI fails or isn't installed
          cliAddresses = await bridge.getDepositAddresses();
        }
        return NextResponse.json({
          success: true,
          addresses: cliAddresses,
          walletAddress,
          chains: CHAIN_INFO,
        });

      case "status": {
        // Get transaction status
        const depositAddress = searchParams.get("address");
        if (!depositAddress) {
          return NextResponse.json(
            { error: "Missing deposit address" },
            { status: 400 }
          );
        }
        const status = await bridge.getTransactionStatus(depositAddress);
        return NextResponse.json({ success: true, transactions: status });
      }

      case "portfolio":
        // Get Polymarket portfolio
        const portfolio = await bridge.getPortfolio();
        return NextResponse.json({ success: true, portfolio });

      default:
        // Return available actions
        return NextResponse.json({
          success: true,
          availableActions: ["assets", "deposit", "status", "portfolio"],
          chains: CHAIN_INFO,
          chainIds: CHAIN_IDS,
        });
    }
  } catch (error) {
    console.error("[Bridge API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST /api/bridge - Create deposit/withdraw/quote
export async function POST(request: NextRequest) {
  try {
    const config = getConfig();
    const activeAccount = await accountStore.getActiveAccount();
    const walletAddress = config.walletAddress || activeAccount?.walletAddress || null

    if (!walletAddress) {
      return NextResponse.json(
        { error: "No wallet connected" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, ...params } = body;

    const bridge = createBridgeProvider(walletAddress);

    switch (action) {
      case "quote": {
        // Get bridge quote
        const { amount, fromChainId, fromToken, toChainId, toToken, recipientAddress } = params;

        if (!amount || !fromChainId || !fromToken || !toChainId || !toToken || !recipientAddress) {
          return NextResponse.json(
            { error: "Missing required parameters: amount, fromChainId, fromToken, toChainId, toToken, recipientAddress" },
            { status: 400 }
          );
        }

        const quote = await bridge.getQuote({
          amount: parseFloat(amount),
          fromChainId: fromChainId as ChainId,
          fromToken,
          toChainId: toChainId as ChainId,
          toToken,
          recipientAddress,
        });

        return NextResponse.json({ success: true, quote });
      }

      case "withdraw": {
        // Create withdrawal
        const { toChainId, toToken, recipientAddr } = params;

        if (!toChainId || !toToken || !recipientAddr) {
          return NextResponse.json(
            { error: "Missing required parameters: toChainId, toToken, recipientAddr" },
            { status: 400 }
          );
        }

        const withdrawal = await bridge.createWithdrawal({
          toChainId: toChainId as ChainId,
          toToken,
          recipientAddr,
        });

        return NextResponse.json({ success: true, withdrawal });
      }

      case "deposit": {
        // Get deposit addresses via CLI wrapper
        let cliAddressesPost;
        try {
          cliAddressesPost = await accountManager.getDepositInfo();
        } catch (e) {
          cliAddressesPost = await bridge.getDepositAddresses();
        }
        return NextResponse.json({
          success: true,
          addresses: cliAddressesPost,
          walletAddress,
          instructions: {
            evm: `Send ${CHAIN_INFO[params.chainId as ChainId]?.name || "EVM"} tokens to this address. NOTE: May require MATIC gas for contract approvals later.`,
            svm: "Send Solana tokens to this address",
            btc: "Send Bitcoin to this address",
          }
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: quote, withdraw, or deposit" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Bridge API] POST Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
