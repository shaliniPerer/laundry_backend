import "dotenv/config";
export const config = {
    port: Number(process.env.PORT) || 4000,
    jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
    jwtExpires: process.env.JWT_EXPIRES || "7d",
    awsRegion: process.env.AWS_REGION || "us-east-1",
    awsEndpoint: process.env.AWS_DYNAMODB_ENDPOINT,
    tableName: process.env.DYNAMODB_TABLE_NAME || "LaundryApp",
};
