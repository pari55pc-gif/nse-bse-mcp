import { NSEClient, NSEApi } from 'nse-bse-api';
import { formatLimitedResponse, LimitOptions } from '../utils/response-limiter.js';

import fs from 'fs/promises';
import path from 'path';

function parseDate(dateStr: string): Date {
  const d = new Date(dateStr);

  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  return d;
}

function extractLimitOptions(args: Record<string, any>): LimitOptions {
  return {
    maxItems: args.max_items,
    fields: args.fields,
    summary: args.summary,
  };
}

/* ============================================================
   DATE HELPERS
   ============================================================ */

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function nextDate(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

function dateRange(from: Date, to: Date): Date[] {
  const dates: Date[] = [];

  let current = new Date(from.getTime());

  while (current <= to) {
    dates.push(new Date(current.getTime()));
    current = nextDate(current);
  }

  return dates;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ============================================================
   CSV HELPERS
   ============================================================ */

/**
 * Simple CSV parser.
 *
 * Handles:
 * - quoted fields
 * - commas inside quoted fields
 * - escaped quotes ("")
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];

  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);

  return result;
}

function parseCsv(content: string): Record<string, any>[] {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((h) =>
    h.trim().replace(/^"|"$/g, '')
  );

  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);

    const row: Record<string, any> = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }

    rows.push(row);
  }

  return rows;
}

async function readDownloadedCsv(filePath: string): Promise<Record<string, any>[]> {
  if (!filePath) {
    return [];
  }

  try {
    const stat = await fs.stat(filePath);

    if (!stat.isFile()) {
      return [];
    }

    const content = await fs.readFile(filePath, 'utf8');

    return parseCsv(content);
  } catch {
    return [];
  }
}

/* ============================================================
   NUMBER / NORMALIZATION HELPERS
   ============================================================ */

function numberOrNull(value: any): number | null {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    value === '-' ||
    value === 'NA'
  ) {
    return null;
  }

  const n = Number(String(value).replace(/,/g, ''));

  return Number.isFinite(n) ? n : null;
}

function cleanString(value: any): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();

  return text === '' ? null : text;
}

/* ============================================================
   EQUITY BHAVCOPY NORMALIZER
   ============================================================ */

function normalizeEquityRow(
  row: Record<string, any>,
  requestedDate: string
): Record<string, any> {
  const symbol =
    row.SYMBOL ??
    row.TckrSymb ??
    row.symbol ??
    row.Symbol;

  const series =
    row.SERIES ??
    row.SctySrs ??
    row.series ??
    'EQ';

  const tradeDate =
    row.DATE1 ??
    row.DATE ??
    row.TradDt ??
    row.TIMESTAMP ??
    requestedDate;

  const open =
    row.OPEN_PRICE ??
    row.OPEN ??
    row.OpnPric;

  const high =
    row.HIGH_PRICE ??
    row.HIGH ??
    row.HghPric;

  const low =
    row.LOW_PRICE ??
    row.LOW ??
    row.LwPric;

  const close =
    row.CLOSE_PRICE ??
    row.CLOSE ??
    row.ClsPric;

  const prevClose =
    row.PREV_CLOSE ??
    row.PrevClose ??
    row.PreviousClose;

  const lastPrice =
    row.LAST_PRICE ??
    row.LAST ??
    row.LastPric;

  const volume =
    row.TTL_TRD_QNTY ??
    row.TOTTRDQTY ??
    row.Volume ??
    row.TtlTradgVol;

  const turnover =
    row.TURNOVER_LACS ??
    row.TOTTRDVAL ??
    row.TtlTrdVal;

  const trades =
    row.NO_OF_TRADES ??
    row.TOTALTRADES ??
    row.NoOfTrades;

  const deliveryQty =
    row.DELIV_QTY ??
    row.DelivQty;

  const deliveryPercent =
    row.DELIV_PER ??
    row.DelivPct;

  return {
    symbol: cleanString(symbol),
    series: cleanString(series),
    date: cleanString(tradeDate) ?? requestedDate,

    open: numberOrNull(open),
    high: numberOrNull(high),
    low: numberOrNull(low),
    close: numberOrNull(close),

    lastPrice: numberOrNull(lastPrice),
    prevClose: numberOrNull(prevClose),

    volume: numberOrNull(volume),
    turnover: numberOrNull(turnover),
    trades: numberOrNull(trades),

    deliveryQty: numberOrNull(deliveryQty),
    deliveryPercent: numberOrNull(deliveryPercent),

    source: 'NSE_EQUITY_BHAVCOPY',
  };
}

/* ============================================================
   F&O BHAVCOPY NORMALIZER
   ============================================================ */

function normalizeFnoRow(
  row: Record<string, any>,
  requestedDate: string
): Record<string, any> {
  const symbol =
    row.SYMBOL ??
    row.symbol ??
    row.TckrSymb;

  const instrument =
    row.INSTRUMENT ??
    row.Instrument ??
    row.FinInstrmTp;

  const expiry =
    row.EXPIRY_DT ??
    row.EXPIRY_DATE ??
    row.XpryDt ??
    row.expiryDate;

  const strike =
    row.STRIKE_PR ??
    row.STRIKE_PRICE ??
    row.StrkPric ??
    row.strikePrice;

  const optionType =
    row.OPTION_TYP ??
    row.OPTION_TYPE ??
    row.OptnTp ??
    row.optionType;

  const open =
    row.OPEN ??
    row.Open ??
    row.OpnPric;

  const high =
    row.HIGH ??
    row.High ??
    row.HghPric;

  const low =
    row.LOW ??
    row.Low ??
    row.LwPric;

  const close =
    row.CLOSE ??
    row.Close ??
    row.ClsPric;

  const settle =
    row.SETTLE_PR ??
    row.SETTLE_PRICE ??
    row.SttlmPric;

  const contracts =
    row.CONTRACTS ??
    row.Contracts ??
    row.TtlNbOfTxsExctd;

  const value =
    row.VAL_INLAKH ??
    row.VALUE ??
    row.TtlTrdVal;

  const openInterest =
    row.OPEN_INT ??
    row.OPEN_INTEREST ??
    row.OpnIntrst;

  const changeInOpenInterest =
    row.CHG_IN_OI ??
    row.CHANGE_IN_OI ??
    row.ChngInOpnIntrst;

  const timestamp =
    row.TIMESTAMP ??
    row.DATE ??
    row.TradDt ??
    requestedDate;

  return {
    symbol: cleanString(symbol),
    instrument: cleanString(instrument),

    expiryDate: cleanString(expiry),
    strikePrice: numberOrNull(strike),
    optionType: cleanString(optionType),

    open: numberOrNull(open),
    high: numberOrNull(high),
    low: numberOrNull(low),
    close: numberOrNull(close),
    settlePrice: numberOrNull(settle),

    contracts: numberOrNull(contracts),
    value: numberOrNull(value),

    openInterest: numberOrNull(openInterest),
    changeInOpenInterest: numberOrNull(changeInOpenInterest),

    date: cleanString(timestamp) ?? requestedDate,

    source: 'NSE_FNO_BHAVCOPY',
  };
}

/* ============================================================
   EQUITY HISTORICAL FALLBACK
   ============================================================ */

async function fetchEquityHistoricalFallback(
  nse: NSEClient,
  symbol: string,
  from: Date,
  to: Date,
  series = 'EQ'
): Promise<Record<string, any>[]> {
  const result: Record<string, any>[] = [];

  const dates = dateRange(from, to);

  for (const date of dates) {
    const requestedDate = dateKey(date);

    try {
      /*
       * NSE publishes daily equity bhavcopy.
       * This is much more reliable for backtesting than relying
       * exclusively on the historical GetQuoteApi.
       */
      const filePath = await nse.equityBhavcopy(date);

      const rows = await readDownloadedCsv(String(filePath));

      if (!rows.length) {
        continue;
      }

      for (const row of rows) {
        const rowSymbol = String(
          row.SYMBOL ??
          row.TckrSymb ??
          row.symbol ??
          ''
        ).trim().toUpperCase();

        const rowSeries = String(
          row.SERIES ??
          row.SctySrs ??
          row.series ??
          ''
        ).trim().toUpperCase();

        if (rowSymbol !== symbol.toUpperCase()) {
          continue;
        }

        if (series && rowSeries && rowSeries !== series.toUpperCase()) {
          continue;
        }

        result.push(
          normalizeEquityRow(row, requestedDate)
        );
      }
    } catch {
      /*
       * Weekend / NSE holiday / unavailable report:
       * simply skip that date.
       */
    }

    /*
     * NSE can throttle repeated requests.
     * Keep a small delay between daily report downloads.
     */
    await sleep(350);
  }

  return result;
}

/* ============================================================
   F&O HISTORICAL FALLBACK
   ============================================================ */

async function fetchFnoHistoricalFallback(
  nse: NSEClient,
  symbol: string,
  from: Date,
  to: Date,
  instrumentType?: string,
  expiryDate?: Date,
  optionType?: string,
  strikePrice?: number
): Promise<Record<string, any>[]> {
  const result: Record<string, any>[] = [];

  const dates = dateRange(from, to);

  const wantedSymbol = symbol.toUpperCase();

  const wantedInstrument = instrumentType
    ? instrumentType.toUpperCase()
    : undefined;

  const wantedOptionType = optionType
    ? optionType.toUpperCase()
    : undefined;

  const wantedExpiry = expiryDate
    ? expiryDate.toISOString().slice(0, 10)
    : undefined;

  for (const date of dates) {
    const requestedDate = dateKey(date);

    try {
      const filePath = await nse.fnoBhavcopy(date);

      const rows = await readDownloadedCsv(String(filePath));

      if (!rows.length) {
        continue;
      }

      for (const row of rows) {
        const rowSymbol = String(
          row.SYMBOL ??
          row.symbol ??
          ''
        ).trim().toUpperCase();

        if (rowSymbol !== wantedSymbol) {
          continue;
        }

        const rowInstrument = String(
          row.INSTRUMENT ??
          row.Instrument ??
          ''
        ).trim().toUpperCase();

        if (
          wantedInstrument &&
          rowInstrument !== wantedInstrument
        ) {
          continue;
        }

        const rowOptionType = String(
          row.OPTION_TYP ??
          row.OPTION_TYPE ??
          ''
        ).trim().toUpperCase();

        if (
          wantedOptionType &&
          rowOptionType !== wantedOptionType
        ) {
          continue;
        }

        if (
          strikePrice !== undefined &&
          strikePrice !== null
        ) {
          const rowStrike = numberOrNull(
            row.STRIKE_PR ??
            row.STRIKE_PRICE
          );

          if (
            rowStrike === null ||
            rowStrike !== Number(strikePrice)
          ) {
            continue;
          }
        }

        if (wantedExpiry) {
          const rawExpiry =
            row.EXPIRY_DT ??
            row.EXPIRY_DATE ??
            row.XpryDt;

          if (rawExpiry) {
            const expiryText = String(rawExpiry).trim();

            /*
             * Keep comparison flexible because NSE historical
             * bhavcopies can contain formats such as:
             * 28-Aug-2026
             * 2026-08-28
             * 28/08/2026
             */
            const parsedExpiry = new Date(expiryText);

            if (
              !Number.isNaN(parsedExpiry.getTime()) &&
              parsedExpiry.toISOString().slice(0, 10) !== wantedExpiry
            ) {
              continue;
            }
          }
        }

        result.push(
          normalizeFnoRow(row, requestedDate)
        );
      }
    } catch {
      /*
       * Weekend / holiday / unavailable report:
       * skip silently.
       */
    }

    await sleep(350);
  }

  return result;
}

/* ============================================================
   MAIN NSE HANDLER
   ============================================================ */

export async function handleNseTool(
  name: string,
  args: Record<string, any>,
  nse: NSEClient
): Promise<any> {
  try {
    let result: any;

    switch (name) {
      // ======================================================
      // MARKET DATA
      // ======================================================

      case 'nse_get_market_status':
        result = await nse.status();
        break;

      case 'nse_equity_quote':
        result = await nse.equityQuote(args.symbol);
        break;

      case 'nse_get_quote':
        result = await nse.quote({
          symbol: args.symbol,
          segment: args.segment,
        });
        break;

      case 'nse_lookup_symbol':
        result = await nse.lookup(args.query);
        break;

      case 'nse_get_gainers': {
        const data = await nse.listEquityStocksByIndex('NIFTY 50');
        result = nse.gainers(data, args.count || 10);
        break;
      }

      case 'nse_get_losers': {
        const data = await nse.listEquityStocksByIndex('NIFTY 50');
        result = nse.losers(data, args.count || 10);
        break;
      }

      // ======================================================
      // HISTORICAL EQUITY
      // ======================================================

      case 'nse_equity_historical': {
        const from = parseDate(args.from_date);
        const to = parseDate(args.to_date);

        let historical: any[] = [];

        /*
         * PRIMARY:
         * Existing library historical API.
         */
        try {
          historical =
            await nse.fetch_equity_historical_data({
              symbol: args.symbol,
              from_date: from,
              to_date: to,
              series: args.series || 'EQ',
            });
        } catch {
          historical = [];
        }

        /*
         * FALLBACK:
         * Daily NSE equity bhavcopy.
         *
         * This is the important BTST/backtest fix.
         */
        if (!Array.isArray(historical) || historical.length === 0) {
          historical =
            await fetchEquityHistoricalFallback(
              nse,
              args.symbol,
              from,
              to,
              args.series || 'EQ'
            );
        }

        result = historical;
        break;
      }

      // ======================================================
      // HISTORICAL F&O
      // ======================================================

      case 'nse_fno_historical': {
        const from = parseDate(args.from_date);
        const to = parseDate(args.to_date);

        const expiryDate = args.expiry_date
          ? parseDate(args.expiry_date)
          : undefined;

        let historical: any[] = [];

        /*
         * PRIMARY:
         * Existing historical API.
         */
        try {
          historical =
            await nse.fetch_historical_fno_data({
              symbol: args.symbol,

              from_date: from,
              to_date: to,

              instrument_type:
                args.instrument_type,

              expiry_date:
                expiryDate,

              option_type:
                args.option_type,

              strike_price:
                args.strike_price,
            });
        } catch {
          historical = [];
        }

        /*
         * FALLBACK:
         * Daily NSE F&O bhavcopy.
         */
        if (!Array.isArray(historical) || historical.length === 0) {
          historical =
            await fetchFnoHistoricalFallback(
              nse,
              args.symbol,
              from,
              to,
              args.instrument_type,
              expiryDate,
              args.option_type,
              args.strike_price
            );
        }

        result = historical;
        break;
      }

      // ======================================================
      // VIX
      // ======================================================

      case 'nse_vix_historical':
        result = await nse.fetch_historical_vix_data({
          from_date: args.from_date
            ? parseDate(args.from_date)
            : undefined,

          to_date: args.to_date
            ? parseDate(args.to_date)
            : undefined,
        });
        break;

      // ======================================================
      // OPTIONS & DERIVATIVES
      // ======================================================

      case 'nse_get_expiry_dates':
        result = await nse.getExpiryDatesV3(args.symbol);
        break;

      case 'nse_option_chain':
        result = await nse.optionChainV3({
          symbol: args.symbol,
          expiry: args.expiry,
          type: args.type,
        });
        break;

      case 'nse_filtered_option_chain':
        result = await nse.filteredOptionChainV3(
          args.symbol,
          args.expiry,
          args.strike_range
        );
        break;

      case 'nse_compile_option_chain':
        result = await nse.compileOptionChainV3(
          args.symbol,
          args.expiry
        );
        break;

      case 'nse_calculate_max_pain': {
        const optionChainV3 =
          await nse.optionChainV3({
            symbol: args.symbol,
            expiry: args.expiry,
          });

        result =
          NSEApi.OptionsApi.calculateMaxPainV3(
            optionChainV3,
            args.expiry
          );

        break;
      }

      case 'nse_fno_lots':
        result = await nse.fnoLots();
        break;

      case 'nse_futures_expiry':
        result = await nse.getFuturesExpiry(
          args.index || 'nifty'
        );
        break;

      // ======================================================
      // CORPORATE INFORMATION
      // ======================================================

      case 'nse_corporate_actions':
        result = await nse.actions({
          symbol: args.symbol,

          from_date: args.from_date
            ? parseDate(args.from_date)
            : undefined,

          to_date: args.to_date
            ? parseDate(args.to_date)
            : undefined,

          segment: args.segment,
        });
        break;

      case 'nse_corporate_announcements':
        result = await nse.announcements({
          symbol: args.symbol,

          from_date: args.from_date
            ? parseDate(args.from_date)
            : undefined,

          to_date: args.to_date
            ? parseDate(args.to_date)
            : undefined,
        });
        break;

      case 'nse_board_meetings':
        result = await nse.boardMeetings({
          symbol: args.symbol,

          from_date: args.from_date
            ? parseDate(args.from_date)
            : undefined,

          to_date: args.to_date
            ? parseDate(args.to_date)
            : undefined,
        });
        break;

      case 'nse_annual_reports':
        result = await nse.annual_reports(
          args.symbol,
          args.segment || 'equities'
        );
        break;

      case 'nse_circulars':
        result = await nse.circulars({
          from_date: args.from_date
            ? parseDate(args.from_date)
            : undefined,

          to_date: args.to_date
            ? parseDate(args.to_date)
            : undefined,
        });
        break;

      // ======================================================
      // IPO
      // ======================================================

      case 'nse_current_ipos':
        result = await nse.listCurrentIPO();
        break;

      case 'nse_upcoming_ipos':
        result = await nse.listUpcomingIPO();
        break;

      case 'nse_past_ipos':
        result = await nse.listPastIPO(
          args.from_date
            ? parseDate(args.from_date)
            : undefined,

          args.to_date
            ? parseDate(args.to_date)
            : undefined
        );
        break;

      case 'nse_ipo_details':
        result = await nse.getIpoDetails({
          symbol: args.symbol,
        });
        break;

      // ======================================================
      // MARKET ACTIVITY
      // ======================================================

      case 'nse_block_deals':
        result = await nse.blockDeals();
        break;

      case 'nse_bulk_deals':
        result = await nse.bulkdeals(
          parseDate(args.from_date),
          parseDate(args.to_date)
        );
        break;

      case 'nse_holidays':
        result = await nse.holidays(
          args.type || 'trading'
        );
        break;

      // ======================================================
      // LISTS & METADATA
      // ======================================================

      case 'nse_list_indices':
        result = await nse.listIndices();
        break;

      case 'nse_list_stocks_by_index':
        result =
          await nse.listEquityStocksByIndex(
            args.index
          );
        break;

      case 'nse_list_etf':
        result = await nse.listEtf();
        break;

      case 'nse_list_sme':
        result = await nse.listSme();
        break;

      case 'nse_list_sgb':
        result = await nse.listSgb();
        break;

      case 'nse_equity_meta_info':
        result =
          await nse.equityMetaInfo(args.symbol);
        break;

      // ======================================================
      // DOWNLOADS
      // ======================================================

      case 'nse_download_equity_bhavcopy':
        result =
          await nse.equityBhavcopy(
            parseDate(args.date)
          );
        break;

      case 'nse_download_delivery_bhavcopy':
        result =
          await nse.deliveryBhavcopy(
            parseDate(args.date)
          );
        break;

      case 'nse_download_indices_bhavcopy':
        result =
          await nse.indicesBhavcopy(
            parseDate(args.date)
          );
        break;

      case 'nse_download_fno_bhavcopy':
        result =
          await nse.fnoBhavcopy(
            parseDate(args.date)
          );
        break;

      // ======================================================
      // UNKNOWN
      // ======================================================

      default:
        throw new Error(
          `Unknown NSE tool: ${name}`
        );
    }

    // ========================================================
    // RESPONSE LIMITING
    // ========================================================

    const limitOptions =
      extractLimitOptions(args);

    return formatLimitedResponse(
      result,
      limitOptions
    );

  } catch (error: any) {
    throw new Error(
      `NSE API Error: ${error?.message || String(error)}`
    );
  }
}
