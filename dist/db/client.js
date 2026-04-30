import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { config } from "../config.js";
const client = new DynamoDBClient({
    region: config.awsRegion,
    ...(config.awsEndpoint
        ? { endpoint: config.awsEndpoint, credentials: { accessKeyId: "local", secretAccessKey: "local" } }
        : {}),
});
export const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
});
