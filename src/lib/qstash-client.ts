import { Client } from "@upstash/qstash";

let qstashClient: Client | null = null;

export function getQstashClient(): Client {
  if (!qstashClient) {
    qstashClient = new Client({
      token: process.env.QSTASH_TOKEN,
      baseUrl: process.env.QSTASH_URL,
    });
  }

  return qstashClient;
}
