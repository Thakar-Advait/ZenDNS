import { Resolver } from "dns/promises";
import { redisClient as redis, sql as pgClient } from "../db/index.js";

const resolver = new Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);

const fetchIP4 = async (domain) => {
    try {
        const exists = await redis.exists(`A:${domain}`);
        if (exists === 1) {  // Explicit check
            console.log("Returning from cache");
            const ip = await redis.get(`A:${domain}`);
            return { domain, ip, ttl: 3000 };
        }

        const query = `
            SELECT domain_name, ip_address, ttl 
            FROM a_records 
            WHERE domain_name=$1 
            AND (EXTRACT(EPOCH FROM NOW() - updated_at) < ttl);
        `;
        const values = [domain];
        const response = await pgClient.query(query, values);
        const dns_records = response;
        if (dns_records.length > 0) {
            console.log("Inserting into cache");
            redis.setEx(`A:${domain}`, 3000, dns_records[0].ip_address);
            console.log("Inserted into cache");
            console.log("Returning from DB");

            return {
                domain: dns_records[0].domain_name,
                ip: dns_records[0].ip_address,
                ttl: 3000
            };
        }

        const resolvedIPs = await resolver.resolve4(domain);
        if(resolvedIPs.length === 0) {
            const error = new Error("NO DATA")
            error.code = "NODATA"
            throw error;
        }
        const newIP = resolvedIPs[0];
        

        const insertQuery = `
            INSERT INTO a_records (domain_name, ip_address, ttl) 
            VALUES ($1, $2, $3) 
            ON CONFLICT (domain_name) 
            DO UPDATE SET ip_address = EXCLUDED.ip_address, ttl = EXCLUDED.ttl, updated_at = NOW();
        `;
        const insertValues = [domain, newIP, 3000];

        await pgClient.query(insertQuery, insertValues);
        console.log("Inserting into cache");
        redis.setEx(`A:${domain}`, 3000, newIP);
        console.log("Inserted into cache");
        console.log("Returning from external DNS");

        return { domain, ip: newIP, ttl: 3000 };

    } catch (error) {
        console.error(`Error in fetchIP4 for ${domain}:`, error);
        throw new Error(error.code)
    }
};

export default fetchIP4;
