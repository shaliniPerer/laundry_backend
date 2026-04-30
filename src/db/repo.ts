import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "./client.js";
import { config } from "../config.js";

const TableName = config.tableName;

export async function putItem(item: Record<string, unknown>) {
  await docClient.send(new PutCommand({ TableName, Item: item }));
}

export async function getItem(pk: string, sk: string) {
  const res = await docClient.send(new GetCommand({ TableName, Key: { pk, sk } }));
  return res.Item;
}

export async function deleteItem(pk: string, sk: string) {
  await docClient.send(new DeleteCommand({ TableName, Key: { pk, sk } }));
}

export async function queryByPk(pk: string) {
  const res = await docClient.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": pk },
    })
  );
  return res.Items ?? [];
}

export async function scanByEntityPrefix(prefix: string) {
  const res = await docClient.send(
    new ScanCommand({
      TableName,
      FilterExpression: "begins_with(pk, :p)",
      ExpressionAttributeValues: { ":p": prefix },
    })
  );
  return res.Items ?? [];
}

export async function scanSalesByDeliveryRange(start: string, end: string) {
  const res = await docClient.send(
    new ScanCommand({
      TableName,
      FilterExpression: "entityType = :t AND deliveryDate BETWEEN :a AND :b",
      ExpressionAttributeValues: {
        ":t": "SALE",
        ":a": start,
        ":b": end,
      },
    })
  );
  return res.Items ?? [];
}

export async function updateItem(
  pk: string,
  sk: string,
  updates: Record<string, unknown>
) {
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const sets: string[] = [];
  let i = 0;
  for (const [k, v] of Object.entries(updates)) {
    const nk = `#n${i}`;
    const vk = `:v${i}`;
    names[nk] = k;
    values[vk] = v;
    sets.push(`${nk} = ${vk}`);
    i++;
  }
  await docClient.send(
    new UpdateCommand({
      TableName,
      Key: { pk, sk },
      UpdateExpression: "SET " + sets.join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}
