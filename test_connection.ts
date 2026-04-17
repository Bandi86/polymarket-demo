import { accountManager } from "./src/lib/account-manager";

async function run() {
  console.log("Testing AccountManager connection...");
  const account = await accountManager.getDetailedAccount();
  console.log(JSON.stringify(account, null, 2));
}

run().catch(console.error);
