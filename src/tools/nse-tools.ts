import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { addFilterProperties } from './common-properties.js';

export const nseTools: Tool[] = [
  // ============================================================
  // MARKET DATA
  // ============================================================

  {
    name: 'nse_get_market_status',
    description:
      'Get current NSE market status including trading hours and market state.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'nse_equity_quote',
    description:
      'Get real-time equity quote for a symbol on NSE.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description:
            'Stock symbol (e.g., RELIANCE, TCS, INFY).',
        },
      },
      required: ['symbol'],
    },
  },

  {
    name: 'nse_get_quote',
    description:
      'Get quote for any symbol with segment specification.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol name.',
        },
        segment: {
          type: 'string',
          description:
            'Market segment (equities, sme, mf, debt).',
          enum: ['equities', 'sme', 'mf', 'debt'],
        },
      },
      required: ['symbol'],
    },
  },

  {
    name: 'nse_lookup_symbol',
    description:
      'Search for symbols on NSE by name or partial match.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query (company name or symbol).',
        },
      },
      required: ['query'],
    },
  },

  {
    name: 'nse_get_gainers',
    description:
      'Get top gainers from market data.',
    inputSchema: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description:
            'Number of top gainers to return (default: 10).',
        },
      },
    },
  },

  {
    name: 'nse_get_losers',
    description:
      'Get top losers from market data.',
    inputSchema: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description:
            'Number of top losers to return (default: 10).',
        },
      },
    },
  },

  // ============================================================
  // HISTORICAL EQUITY
  // ============================================================

  {
    name: 'nse_equity_historical',
    description:
      'Fetch historical daily NSE equity OHLCV data. Uses the NSE historical API first and automatically falls back to daily NSE equity bhavcopy when required. Useful for swing, positional and BTST backtesting. Use max_items and fields to limit large responses.',
    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        symbol: {
          type: 'string',
          description:
            'NSE stock symbol, e.g. SBIN, RELIANCE, TCS, COFORGE.',
        },

        from_date: {
          type: 'string',
          description:
            'Start date in YYYY-MM-DD format.',
        },

        to_date: {
          type: 'string',
          description:
            'End date in YYYY-MM-DD format.',
        },

        series: {
          type: 'string',
          description:
            'NSE equity series. Default is EQ.',
          default: 'EQ',
        },
      }),

      required: [
        'symbol',
        'from_date',
        'to_date',
      ],
    },
  },

  // ============================================================
  // HISTORICAL F&O
  // ============================================================

  {
  name: 'nse_fno_historical',
  description:
    'Fetch historical F&O data for backtesting. Supports futures/options filtering by instrument type, expiry, option type and strike price. Use max_items and fields to limit large responses.',
  inputSchema: {
    type: 'object',
    properties: addFilterProperties({
      symbol: {
        type: 'string',
        description: 'Symbol name, e.g. RELIANCE, SBIN, TCS',
      },
      from_date: {
        type: 'string',
        description: 'Start date (YYYY-MM-DD)',
      },
      to_date: {
        type: 'string',
        description: 'End date (YYYY-MM-DD)',
      },
      instrument_type: {
        type: 'string',
        description:
          'Instrument type: FUTIDX, FUTSTK, OPTIDX, OPTSTK',
      },
      expiry_date: {
        type: 'string',
        description: 'Expiry date (YYYY-MM-DD)',
      },
      option_type: {
        type: 'string',
        description: 'Option type filter: CE or PE',
        enum: ['CE', 'PE'],
      },
      strike_price: {
        type: 'number',
        description: 'Exact option strike price filter',
      },
    }),
    required: ['symbol', 'from_date', 'to_date'],
  },
},
  // ======================================================
// F&O BHAVCOPY PARSED DATA
// ======================================================

case 'nse_fno_bhavcopy_data':
  result = await getFnoBhavcopyData(
    nse,
    args
  );
  break;
  // ============================================================
  // VIX
  // ============================================================

  {
    name: 'nse_vix_historical',
    description:
      'Fetch historical NSE India VIX data. Use max_items and fields to limit large responses.',
    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        from_date: {
          type: 'string',
          description:
            'Start date in YYYY-MM-DD format.',
        },

        to_date: {
          type: 'string',
          description:
            'End date in YYYY-MM-DD format.',
        },
      }),
    },
  },

  // ============================================================
  // OPTIONS & DERIVATIVES
  // ============================================================

  {
    name: 'nse_get_expiry_dates',

    description:
      'Get all available option expiry dates for a symbol. Call this first before using option-chain tools.',

    inputSchema: {
      type: 'object',

      properties: {
        symbol: {
          type: 'string',
          description:
            'Trading symbol. Examples: NIFTY, BANKNIFTY, RELIANCE, TCS, SBIN.',
        },
      },

      required: ['symbol'],
    },
  },

  {
    name: 'nse_option_chain',

    description:
      'Get complete option chain data including CE and PE price, OI, change in OI, IV and volume.',

    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        symbol: {
          type: 'string',
          description:
            'Trading symbol.',
        },

        expiry: {
          type: 'string',
          description:
            'Expiry date in DD-Mon-YYYY format.',
        },

        type: {
          type: 'string',
          description:
            'Option type category.',
          enum: ['Indices', 'Equity'],
        },
      }),

      required: ['symbol'],
    },
  },

  {
    name: 'nse_filtered_option_chain',

    description:
      'Get compact option-chain data around ATM strikes. Includes CE/PE price, OI, change in OI, IV and volume.',

    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        symbol: {
          type: 'string',
          description:
            'Trading symbol.',
        },

        expiry: {
          type: 'string',
          description:
            'Expiry date in DD-Mon-YYYY format.',
        },

        strike_range: {
          type: 'number',
          description:
            'Number of strikes above and below ATM. Default 10.',
        },
      }),

      required: ['symbol'],
    },
  },

  {
    name: 'nse_compile_option_chain',

    description:
      'Get calculated option-chain analytics including ATM, max pain, PCR, CE/PE OI and per-strike analytics.',

    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        symbol: {
          type: 'string',
          description:
            'Trading symbol.',
        },

        expiry: {
          type: 'string',
          description:
            'Expiry date in DD-Mon-YYYY format.',
        },
      }),

      required: [
        'symbol',
        'expiry',
      ],
    },
  },

  {
    name: 'nse_calculate_max_pain',

    description:
      'Calculate max-pain strike for an option expiry.',

    inputSchema: {
      type: 'object',

      properties: {
        symbol: {
          type: 'string',
          description:
            'Trading symbol.',
        },

        expiry: {
          type: 'string',
          description:
            'Expiry date in DD-Mon-YYYY format.',
        },
      },

      required: [
        'symbol',
        'expiry',
      ],
    },
  },

  {
    name: 'nse_fno_lots',

    description:
      'Get NSE F&O lot sizes for all available symbols. Use max_items and fields to limit the response.',

    inputSchema: {
      type: 'object',

      properties: addFilterProperties({}),
    },
  },

  {
    name: 'nse_futures_expiry',

    description:
      'Get futures expiry dates.',

    inputSchema: {
      type: 'object',

      properties: {
        index: {
          type: 'string',
          description:
            'Index name.',
          enum: [
            'nifty',
            'banknifty',
            'finnifty',
          ],
        },
      },
    },
  },

  // ============================================================
  // CORPORATE INFORMATION
  // ============================================================

  {
    name: 'nse_corporate_actions',
    description:
      'Get NSE corporate actions including dividends, splits and bonuses.',
    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        symbol: {
          type: 'string',
          description:
            'Stock symbol.',
        },

        from_date: {
          type: 'string',
          description:
            'Start date YYYY-MM-DD.',
        },

        to_date: {
          type: 'string',
          description:
            'End date YYYY-MM-DD.',
        },

        segment: {
          type: 'string',
          description:
            'Market segment.',
        },
      }),
    },
  },

  {
    name: 'nse_corporate_announcements',
    description:
      'Get NSE corporate announcements.',
    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        symbol: {
          type: 'string',
          description:
            'Stock symbol.',
        },

        from_date: {
          type: 'string',
          description:
            'Start date YYYY-MM-DD.',
        },

        to_date: {
          type: 'string',
          description:
            'End date YYYY-MM-DD.',
        },
      }),
    },
  },

  {
    name: 'nse_board_meetings',
    description:
      'Get NSE board meeting information.',
    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        symbol: {
          type: 'string',
          description:
            'Stock symbol.',
        },

        from_date: {
          type: 'string',
          description:
            'Start date YYYY-MM-DD.',
        },

        to_date: {
          type: 'string',
          description:
            'End date YYYY-MM-DD.',
        },
      }),
    },
  },

  {
    name: 'nse_annual_reports',
    description:
      'Get annual reports for a company.',
    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        symbol: {
          type: 'string',
          description:
            'Stock symbol.',
        },

        segment: {
          type: 'string',
          description:
            'Market segment. Default equities.',
        },
      }),

      required: ['symbol'],
    },
  },

  {
    name: 'nse_circulars',
    description:
      'Get NSE circulars.',
    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        from_date: {
          type: 'string',
          description:
            'Start date YYYY-MM-DD.',
        },

        to_date: {
          type: 'string',
          description:
            'End date YYYY-MM-DD.',
        },
      }),
    },
  },

  // ============================================================
  // IPO
  // ============================================================

  {
    name: 'nse_current_ipos',
    description:
      'List current/ongoing IPOs.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'nse_upcoming_ipos',
    description:
      'List upcoming IPOs.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'nse_past_ipos',
    description:
      'List past IPOs.',
    inputSchema: {
      type: 'object',

      properties: {
        from_date: {
          type: 'string',
          description:
            'Start date YYYY-MM-DD.',
        },

        to_date: {
          type: 'string',
          description:
            'End date YYYY-MM-DD.',
        },
      },
    },
  },

  {
    name: 'nse_ipo_details',
    description:
      'Get detailed IPO information.',
    inputSchema: {
      type: 'object',

      properties: {
        symbol: {
          type: 'string',
          description:
            'IPO symbol.',
        },
      },

      required: ['symbol'],
    },
  },

  // ============================================================
  // MARKET ACTIVITY
  // ============================================================

  {
    name: 'nse_block_deals',
    description:
      'Get NSE block-deal data.',
    inputSchema: {
      type: 'object',
      properties: addFilterProperties({}),
    },
  },

  {
    name: 'nse_bulk_deals',
    description:
      'Get NSE bulk-deal data.',
    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        from_date: {
          type: 'string',
          description:
            'Start date YYYY-MM-DD.',
        },

        to_date: {
          type: 'string',
          description:
            'End date YYYY-MM-DD.',
        },
      }),

      required: [
        'from_date',
        'to_date',
      ],
    },
  },

  {
    name: 'nse_holidays',
    description:
      'Get NSE market holidays.',
    inputSchema: {
      type: 'object',

      properties: {
        type: {
          type: 'string',
          description:
            'Holiday type.',
          enum: [
            'trading',
            'clearing',
          ],
        },
      },
    },
  },

  // ============================================================
  // LISTS & METADATA
  // ============================================================

  {
    name: 'nse_list_indices',
    description:
      'List all NSE indices.',
    inputSchema: {
      type: 'object',
      properties: addFilterProperties({}),
    },
  },

  {
    name: 'nse_list_stocks_by_index',
    description:
      'List stocks belonging to an NSE index.',
    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        index: {
          type: 'string',
          description:
            'Index name. Default NIFTY 50.',
        },
      }),
    },
  },

  {
    name: 'nse_list_etf',
    description:
      'List all NSE ETFs.',
    inputSchema: {
      type: 'object',
      properties: addFilterProperties({}),
    },
  },

  {
    name: 'nse_list_sme',
    description:
      'List all NSE SME stocks.',
    inputSchema: {
      type: 'object',
      properties: addFilterProperties({}),
    },
  },

  {
    name: 'nse_list_sgb',
    description:
      'List all NSE Sovereign Gold Bonds.',
    inputSchema: {
      type: 'object',
      properties: addFilterProperties({}),
    },
  },

  {
    name: 'nse_equity_meta_info',
    description:
      'Get metadata for an NSE equity symbol.',
    inputSchema: {
      type: 'object',

      properties: {
        symbol: {
          type: 'string',
          description:
            'Stock symbol.',
        },
      },

      required: ['symbol'],
    },
  },

  // ============================================================
  // DOWNLOADS
  // ============================================================
// ============================================================
// DOWNLOADS
// ============================================================

{
  name: 'nse_fno_bhavcopy_data',

  description:
    'Return parsed NSE F&O bhavcopy rows as JSON. Defaults to F&O STOCKS ONLY (FUTSTK and OPTSTK). Supports filtering by symbol, instrument type, expiry, option type and strike price. Designed for BTST/blast backtesting.',

  inputSchema: {
    type: 'object',

    properties: addFilterProperties({

      date: {
        type: 'string',
        description:
          'Trading date YYYY-MM-DD.'
      },

      stocks_only: {
        type: 'boolean',
        description:
          'Return only F&O stock contracts FUTSTK and OPTSTK. Default true.',
        default: true
      },

      symbol: {
        type: 'string',
        description:
          'Optional F&O stock symbol, e.g. RELIANCE, SBIN, TCS, COFORGE.'
      },

      instrument_type: {
        type: 'string',
        description:
          'Optional instrument filter.',
        enum: [
          'FUTSTK',
          'OPTSTK'
        ]
      },

      expiry_date: {
        type: 'string',
        description:
          'Optional expiry date YYYY-MM-DD.'
      },

      option_type: {
        type: 'string',
        description:
          'Optional option type filter.',
        enum: [
          'CE',
          'PE'
        ]
      },

      strike_price: {
        type: 'number',
        description:
          'Optional exact option strike price.'
      }

    }),

    required: [
      'date'
    ]
  }
},
  {
    name: 'nse_download_equity_bhavcopy',
    description:
      'Download the NSE daily equity bhavcopy for a specific date.',
    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        date: {
          type: 'string',
          description:
            'Trading date YYYY-MM-DD.',
        },
      }),

      required: ['date'],
    },
  },

  {
    name: 'nse_download_delivery_bhavcopy',
    description:
      'Download NSE delivery bhavcopy for a specific date.',
    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        date: {
          type: 'string',
          description:
            'Trading date YYYY-MM-DD.',
        },
      }),

      required: ['date'],
    },
  },

  {
    name: 'nse_download_indices_bhavcopy',
    description:
      'Download NSE indices bhavcopy for a specific date.',
    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        date: {
          type: 'string',
          description:
            'Trading date YYYY-MM-DD.',
        },
      }),

      required: ['date'],
    },
  },

  {
    name: 'nse_download_fno_bhavcopy',
    description:
      'Download NSE F&O bhavcopy for a specific trading date. Contains futures and options OHLC, volume, turnover, expiry, strike and open-interest data.',
    inputSchema: {
      type: 'object',

      properties: addFilterProperties({
        date: {
          type: 'string',
          description:
            'Trading date YYYY-MM-DD.',
        },
      }),

      required: ['date'],
    },
  },
];
