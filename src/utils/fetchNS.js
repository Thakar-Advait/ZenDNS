import { Resolver } from "dns/promises";
import { client as dbClient, redisClient as redis, sql as pgClient } from "../db/index.js";

const resolver = new Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);

const fetchNS = async (domain) => {
    try {
        const cacheKey = `NS:${domain}`;

        // Check in Redis Cache
        if (await redis.exists(cacheKey)) {
            console.log(`Cache hit for ${domain}`);
            return { domain, server: await redis.get(cacheKey), ttl: 3000 };
        }

        // Check in PostgreSQL Database
        const query = `
            SELECT ns_address, ttl 
            FROM ns_records 
            WHERE domain_name=$1 
            AND (EXTRACT(EPOCH FROM NOW() - updated_at) < ttl);
        `;
        const rows = await pgClient.query(query, [domain]);

        if (rows.length > 0) {
            console.log(`DB hit for ${domain}, caching result`);
            const { ns_address, ttl } = rows[0];

            await redis.setEx(cacheKey, ttl, ns_address);
            return { domain, server: ns_address, ttl };
        }

        // Query External DNS
        const resolvedNS = await resolver.resolveNs(domain);
        if(resolvedNS.length === 0) {
            const error = new Error("NO DATA")
            error.code = "NODATA"
            throw error;
        }
        const newNs = resolvedNS[0];

        // Store in PostgreSQL
        const insertQuery = `
            INSERT INTO ns_records (domain_name, ns_address, ttl, updated_at) 
            VALUES ($1, $2, $3, NOW()) 
            ON CONFLICT (domain_name) 
            DO UPDATE SET ns_address = EXCLUDED.ns_address, ttl = EXCLUDED.ttl, updated_at = NOW();
        `;
        await pgClient.query(insertQuery, [domain, newNs, 3000]);

        // Store in Redis Cache
        await redis.setEx(cacheKey, 3000, newNs);
        console.log(`External DNS hit for ${domain}, cached result`);

        return { domain, server: newNs, ttl: 3000 };

    } catch (error) {
        throw new Error(error.code)
    }
};

export default fetchNS;
