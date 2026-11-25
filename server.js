require("dotenv").config();
const app = require("./src/app");
const connectDatabase = require("./src/config/database");

const port = process.env.PORT || 5000;

async function start() {
  await connectDatabase();
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Unable to start server:", error);
  process.exit(1);
});
