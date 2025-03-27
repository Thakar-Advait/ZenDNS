import { Resolver } from "dns/promises";
import { redisClient as redis, sql as pgClient } from "../db/index.js";

const resolver = new Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);

const fetchCname = async (domain) => {
    try {
        const cacheKey = `CNAME:${domain}`;

        // Check in Redis Cache
        if (await redis.exists(cacheKey)) {
            console.log(`Cache hit for ${domain}`);
            console.log({domain, server: await redis.get(cacheKey), ttl: 3000})
            return { domain, cname: await redis.get(cacheKey), ttl: 3000 };
        }

        // Check in PostgreSQL Database
        const query = `
            SELECT cname_address, ttl 
            FROM cname_records 
            WHERE domain_name=$1 
            AND (EXTRACT(EPOCH FROM NOW() - updated_at) < ttl);
        `;
        const rows = await pgClient.query(query, [domain]);

        if (rows.length > 0) {
            console.log(`DB hit for ${domain}, caching result`);
            const { cname_address, ttl } = rows[0];

            await redis.setEx(cacheKey, ttl, cname_address);
            return { domain, cname: cname_address, ttl };
        }

        // Query External DNS
        const resolvedCname = await resolver.resolveCname(domain);
        if(resolvedCname.length === 0) {
            const error = new Error("NO DATA")
            error.code = "NODATA"
            throw error;
        }
        const newCname = resolvedCname[0];

        // Store in PostgreSQL
        const insertQuery = `
            INSERT INTO cname_records (domain_name, cname_address, ttl, updated_at) 
            VALUES ($1, $2, $3, NOW()) 
            ON CONFLICT (domain_name) 
            DO UPDATE SET cname_address = EXCLUDED.cname_address, ttl = EXCLUDED.ttl, updated_at = NOW();
        `;
        await pgClient.query(insertQuery, [domain, newCname, 3000]);

        // Store in Redis Cache
        await redis.setEx(cacheKey, 3000, newCname);
        console.log(`External DNS hit for ${domain}, cached result`);

        return { domain, cname: newCname, ttl: 3000 };

    } catch (error) {
        throw new Error(error.code)
    }
};

export default fetchCname;
