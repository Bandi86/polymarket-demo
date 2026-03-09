import { useEffect, useRef } from "react";

interface TradingViewWidgetProps {
  symbol?: string;
  interval?: string;
  height?: number;
}

export function TradingViewWidget({ 
  symbol = "BINANCE:BTCUSDT", 
  interval = "5",
  height = 400 
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous script
    if (scriptRef.current) {
      scriptRef.current.remove();
    }

    // Clear container
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (window.TradingView && containerRef.current) {
        new window.TradingView.widget({
          autosize: true,
          symbol: symbol,
          interval: interval,
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#0b0b0f",
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          container_id: containerRef.current.id,
          backgroundColor: "#0b0b0f",
          gridColor: "rgba(255,255,255,0.05)",
          textColor: "#a1a1aa",
          hide_volume: false,
          disabled_features: [
            "header_symbol_search",
            "header_compare",
            "header_chart_type",
            "header_screenshot",
            "header_fullscreen_button",
            "create_volume_indicator_by_default"
          ],
          enabled_features: [
            "hide_left_toolbar_by_default"
          ],
          overrides: {
            "mainSeriesProperties.candleStyle.upColor": "#22c55e",
            "mainSeriesProperties.candleStyle.downColor": "#ef4444",
            "mainSeriesProperties.candleStyle.borderUpColor": "#22c55e",
            "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
            "mainSeriesProperties.candleStyle.wickUpColor": "#22c55e",
            "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",
            "paneProperties.background": "#0b0b0f",
            "paneProperties.vertGridProperties.color": "rgba(255,255,255,0.03)",
            "paneProperties.horzGridProperties.color": "rgba(255,255,255,0.03)",
            "scalesProperties.textColor": "#71717a",
          }
        });
      }
    };

    scriptRef.current = script;
    document.head.appendChild(script);

    return () => {
      if (scriptRef.current) {
        scriptRef.current.remove();
      }
    };
  }, [symbol, interval]);

  return (
    <div 
      id={`tv-chart-${symbol.replace(/[^a-zA-Z0-9]/g, "-")}`}
      ref={containerRef} 
      style={{ height: `${height}px`, width: "100%" }}
      className="tv-container"
    />
  );
}

// Add TradingView to window
declare global {
  interface Window {
    TradingView: {
      widget: new (config: Record<string, unknown>) => unknown;
    };
  }
}
