/**
 * Creates the DynamoDB table used by this API (pk + sk).
 * Run: npx tsx src/scripts/createTable.ts
 * Requires AWS credentials (or local DynamoDB endpoint in .env).
 */
import "dotenv/config";
import { CreateTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { config } from "../config.js";
const client = new DynamoDBClient({
    region: config.awsRegion,
    ...(config.awsEndpoint
        ? { endpoint: config.awsEndpoint, credentials: { accessKeyId: "local", secretAccessKey: "local" } }
        : {}),
});
async function main() {
    const TableName = config.tableName;
    try {
        await client.send(new CreateTableCommand({
            TableName,
            BillingMode: "PAY_PER_REQUEST",
            AttributeDefinitions: [
                { AttributeName: "pk", AttributeType: "S" },
                { AttributeName: "sk", AttributeType: "S" },
            ],
            KeySchema: [
                { AttributeName: "pk", KeyType: "HASH" },
                { AttributeName: "sk", KeyType: "RANGE" },
            ],
        }));
        console.log("Created table:", TableName);
    }
    catch (e) {
        if (e instanceof Error && e.name === "ResourceInUseException") {
            console.log("Table already exists:", TableName);
            return;
        }
        throw e;
    }
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
