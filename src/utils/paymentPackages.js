const PACKAGES = [
  { amount: 1, coins: 10 },
  { amount: 10, coins: 150 },
  { amount: 20, coins: 500 },
  { amount: 35, coins: 1000 }
];

function findPaymentPackage(amount, coins) {
  const numericAmount = Number(amount);
  const numericCoins = Number(coins);
  return PACKAGES.find((item) => item.amount === numericAmount && item.coins === numericCoins);
}

module.exports = { findPaymentPackage };
