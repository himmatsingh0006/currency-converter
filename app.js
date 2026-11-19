const currencies = [
  ["USD", "US Dollar"], ["EUR", "Euro"], ["GBP", "British Pound"], ["INR", "Indian Rupee"],
  ["JPY", "Japanese Yen"], ["CAD", "Canadian Dollar"], ["AUD", "Australian Dollar"],
  ["CHF", "Swiss Franc"], ["CNY", "Chinese Yuan"], ["NZD", "New Zealand Dollar"],
  ["SGD", "Singapore Dollar"], ["HKD", "Hong Kong Dollar"], ["AED", "UAE Dirham"],
  ["SAR", "Saudi Riyal"], ["KRW", "South Korean Won"], ["THB", "Thai Baht"],
  ["MYR", "Malaysian Ringgit"], ["IDR", "Indonesian Rupiah"], ["PHP", "Philippine Peso"],
  ["BRL", "Brazilian Real"], ["MXN", "Mexican Peso"], ["ZAR", "South African Rand"],
  ["TRY", "Turkish Lira"], ["SEK", "Swedish Krona"], ["NOK", "Norwegian Krone"],
  ["DKK", "Danish Krone"], ["PLN", "Polish Zloty"], ["ILS", "Israeli New Shekel"],
  ["EGP", "Egyptian Pound"], ["PKR", "Pakistani Rupee"], ["BDT", "Bangladeshi Taka"],
  ["LKR", "Sri Lankan Rupee"], ["VND", "Vietnamese Dong"], ["NGN", "Nigerian Naira"],
];

const amountInput = document.querySelector("#amount");
const fromSelect = document.querySelector("#from-currency");
const toSelect = document.querySelector("#to-currency");
const resultOutput = document.querySelector("#result");
const rateText = document.querySelector("#rate-text");
const updatedText = document.querySelector("#updated-text");
const statusMessage = document.querySelector("#status-message");
const refreshButton = document.querySelector("#refresh-button");

let currentRates = null;
let currentBase = "";
let latestRatesRequest = 0;

function populateCurrencies(select, selectedCode) {
  for (const [code, name] of currencies) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = code;
    option.title = name;
    option.selected = code === selectedCode;
    select.append(option);
  }
}

function addAvailableCurrencies(rates) {
  const knownCodes = new Set(currencies.map(([code]) => code));
  const additionalCodes = Object.keys(rates)
    .filter((code) => !knownCodes.has(code))
    .sort();

  for (const select of [fromSelect, toSelect]) {
    const selectedCode = select.value;
    for (const code of additionalCodes) {
      if (select.querySelector(`option[value="${code}"]`)) continue;
      const option = document.createElement("option");
      option.value = code;
      option.textContent = code;
      select.append(option);
    }
    select.value = selectedCode;
  }
}

populateCurrencies(fromSelect, "USD");
populateCurrencies(toSelect, "INR");

function formatNumber(value, currency) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function renderConversion() {
  const amount = Number(amountInput.value);
  const from = fromSelect.value;
  const to = toSelect.value;

  if (amountInput.value.trim() === "" || !Number.isFinite(amount) || amount < 0) {
    resultOutput.textContent = "—";
    statusMessage.textContent = "Enter a valid amount greater than or equal to zero.";
    return;
  }

  statusMessage.textContent = "";
  if (!currentRates || currentBase !== from) {
    resultOutput.textContent = "…";
    rateText.textContent = "Fetching the latest exchange rate…";
    return;
  }

  const sourceRate = Number(currentRates[from]);
  const targetRate = Number(currentRates[to]);
  if (!Number.isFinite(sourceRate) || !Number.isFinite(targetRate) || sourceRate <= 0 || targetRate <= 0) {
    resultOutput.textContent = "—";
    statusMessage.textContent = "This currency is not available right now. Please choose another.";
    return;
  }

  const converted = amount * targetRate / sourceRate;
  resultOutput.textContent = formatNumber(converted, to);
  rateText.textContent = `1 ${from} = ${formatNumber(targetRate / sourceRate, to)}`;
}

async function loadRates(forceRefresh = false) {
  const base = fromSelect.value;
  if (!forceRefresh && currentRates && currentBase === base) {
    renderConversion();
    return;
  }

  const requestId = ++latestRatesRequest;
  statusMessage.textContent = "";
  rateText.textContent = "Fetching the latest exchange rate…";
  refreshButton.classList.add("is-loading");
  refreshButton.disabled = true;

  try {
    // Call the public exchange-rate API directly. This works on Vercel static hosting
    // and does not depend on the local Python /api/rates route.
    const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: forceRefresh ? "no-store" : "default",
    });

    if (!response.ok) {
      throw new Error(`Exchange-rate service error (HTTP ${response.status}). Please try again.`);
    }

    const data = await response.json();
    if (data.result !== "success" || !data.rates || typeof data.rates !== "object") {
      throw new Error(data['error-type'] || "The exchange-rate service returned an unexpected response.");
    }

    if (requestId !== latestRatesRequest || fromSelect.value !== base) return;

    currentRates = data.rates;
    currentBase = data.base_code || base;
    addAvailableCurrencies(currentRates);

    const updated = data.time_last_update_utc ? new Date(data.time_last_update_utc) : null;
    updatedText.textContent = updated && !Number.isNaN(updated.getTime())
      ? `Rates updated ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(updated)}`
      : "Rates provided by ExchangeRate-API";

    renderConversion();
  } catch (error) {
    if (requestId === latestRatesRequest && fromSelect.value === base) {
      currentRates = null;
      currentBase = "";
      resultOutput.textContent = "—";
      rateText.textContent = "Exchange rate unavailable";
      statusMessage.textContent = error instanceof TypeError
        ? "Could not connect to the exchange-rate service. Check your internet connection and try again."
        : error.message;
    }
  } finally {
    if (requestId === latestRatesRequest) {
      refreshButton.classList.remove("is-loading");
      refreshButton.disabled = false;
    }
  }
}

fromSelect.addEventListener("change", () => loadRates());
toSelect.addEventListener("change", renderConversion);
amountInput.addEventListener("input", renderConversion);
refreshButton.addEventListener("click", () => loadRates(true));

document.querySelector("#swap-button").addEventListener("click", () => {
  const previousFrom = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = previousFrom;
  loadRates();
});

loadRates();
