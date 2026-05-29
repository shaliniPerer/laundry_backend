import "dotenv/config";
export const config = {
    port: Number(process.env.PORT) || 4000,
    jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
    jwtExpires: process.env.JWT_EXPIRES || "7d",
    awsRegion: process.env.AWS_REGION || "us-east-1",
    awsEndpoint: process.env.AWS_DYNAMODB_ENDPOINT,
    tableName: process.env.DYNAMODB_TABLE_NAME || "LaundryApp",
    /** SMS gateway + automation settings */
    sms: {
        /**
         * Provider adapter to use.
         * Values: "getapi" (default) | "generic" | "twilio" | "notifylk"
         *
         * "getapi"  — GET-based API:
         *   {baseUrl}/api/mt/SendSMS?APIKey=…&senderid=…&channel=2&DCS=0&
         *              flashsms=0&mobiles=…&message=…&route=1
         *   Set SMS_BASE_URL + SMS_API_KEY + SMS_SENDER_ID
         *
         * "generic" — JSON POST + Bearer token (Vonage, Africa's Talking, Termii…)
         * "twilio"  — Twilio REST API (Basic Auth, form-encoded body)
         * "notifylk"— Notify.lk JSON POST API
         */
        provider: process.env.SMS_PROVIDER || "getapi",
        // ── GET-based API (getapi provider) ──────────────────────────────
        /** Base URL, e.g. https://www.example.com */
        smsBaseUrl: process.env.SMS_BASE_URL || "",
        /** API key passed as APIKey query param */
        smsApiKey: process.env.SMS_API_KEY || "",
        /** Sender ID / name passed as senderid query param */
        smsSenderId: process.env.SMS_SENDER_ID || "LaundryPro",
        // ── Generic / Vonage / Africa's Talking ──────────────────────────
        /** Full REST endpoint (used by the "generic" provider) */
        smsApiUrl: process.env.SMS_API_URL || "",
        // ── Notify.lk ────────────────────────────────────────────────────
        notifylkUserId: process.env.SMS_NOTIFYLK_USER_ID || "",
        // ── Twilio ───────────────────────────────────────────────────────
        /** Twilio Account SID (SMS_API_KEY is used as the Auth Token) */
        twilioAccountSid: process.env.SMS_TWILIO_ACCOUNT_SID || "",
        // ── Template context ─────────────────────────────────────────────
        /** Injected as {business_name} in every template automatically */
        businessName: process.env.BUSINESS_NAME || "LaundryPro",
    },
};
