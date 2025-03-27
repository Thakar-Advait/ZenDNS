// import pkg from "pg";
import { createClient } from "redis";
import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config()

// const { Client } = pkg;

// export const client = new Client({
//     user: "postgres",
//     host: "localhost",
//     database: "DNS",
//     password: "postgres",
//     port: 5432
// })
export const redisClient = createClient(process.env.REDIS_PORT);
export const sql = neon(process.env.NEON_DB)

export const connectDb = async () => {
    try {
        // await client.connect();
        await redisClient.connect();
        console.log(`Successfully Connected to Postgres and Redis!`);
        return { redisClient, sql }
    } catch (error) {
        throw new Error(error);
    }
}