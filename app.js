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
const convertButton = document.querySelector("#convert-button");
const refreshButton = document.querySelector("#refresh-button");
let currentRates = null;
let currentBase = "";

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
  const additionalCodes = Object.keys(rates).filter((code) => !knownCodes.has(code)).sort();
  for (const select of [fromSelect, toSelect]) {
    const selectedCode = select.value;
    for (const code of additionalCodes) {
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

  const sourceRate = currentRates[from];
  const targetRate = currentRates[to];
  if (!sourceRate || !targetRate) {
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

  statusMessage.textContent = "";
  refreshButton.classList.add("is-loading");
  refreshButton.disabled = true;
  try {
    const response = await fetch(`/api/rates?base=${encodeURIComponent(base)}${forceRefresh ? `&refresh=${Date.now()}` : ""}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not load exchange rates.");
    }

    currentRates = data.rates;
    currentBase = data.base;
    addAvailableCurrencies(currentRates);
    const updated = data.updated ? new Date(data.updated) : null;
    updatedText.textContent = updated && !Number.isNaN(updated.getTime())
      ? `Updated ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(updated)}`
      : "Rates refresh every 10 minutes";
    renderConversion();
  } catch (error) {
    resultOutput.textContent = "—";
    rateText.textContent = "Exchange rate unavailable";
    statusMessage.textContent = error.message;
  } finally {
    refreshButton.classList.remove("is-loading");
    refreshButton.disabled = false;
  }
}

fromSelect.addEventListener("change", () => loadRates());
toSelect.addEventListener("change", renderConversion);
amountInput.addEventListener("input", renderConversion);
convertButton.addEventListener("click", renderConversion);
refreshButton.addEventListener("click", () => loadRates(true));

document.querySelector("#swap-button").addEventListener("click", () => {
  const previousFrom = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = previousFrom;
  loadRates();
});

loadRates();
