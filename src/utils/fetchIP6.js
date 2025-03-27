import { Resolver } from "dns/promises"
import { redisClient as redis, sql as pgClient } from "../db/index.js"

const resolver = new Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);

const fetchIP6 = async (domain) => {
    try {
        const exists = await redis.exists(`AAAA:${domain}`);
        if(exists) {
            return new Promise(async (resolve, reject) => {
                console.log("Returning from cache")
                const ip = await redis.get(`AAAA:${domain}`);
                resolve({
                    domain: domain,
                    ip: ip,
                    ttl: 3000
                });
            })
        }
        
        const query = `Select * From aaaa_records Where domain_name=$1 AND updated_at + interval '1 second' * ttl > now()`;
        const values = [domain];
        const response = await pgClient.query(query, values);
        const dns_records = response;
        if (dns_records.length > 0) {
            return new Promise((resolve, reject) => {
                console.log("Inserting into cache")
                redis.setEx(`AAAA:${domain}`, 300, dns_records[0].ip_address);
                console.log("Inserted into cache")
                console.log("Returning from db")
                resolve({
                    domain: dns_records[0].domain_name,
                    ip: dns_records[0].ip_address,
                    ttl: dns_records[0].ttl
                });
            })
        }

        const resolvedIPs = await resolver.resolve6(domain);
        if(resolvedIPs.length === 0) {
            const error = new Error("NO DATA")
            error.code = "NODATA"
            throw error;
        }
        return new Promise(async (resolve, reject) => {
            const query = "INSERT INTO aaaa_records (domain_name, ip_address, ttl) VALUES ($1, $2, $3) ON CONFLICT (domain_name) DO UPDATE SET ip_address = EXCLUDED.ip_address, ttl = EXCLUDED.ttl, updated_at = now()";
            const values = [domain, resolvedIPs[0], 3000];
            await pgClient.query(query, values);
            console.log("Inserting into cache")
            redis.setEx(`AAAA:${domain}`, 3000, resolvedIPs[0]);
            console.log("Inserted into cache")
            console.log("Returning from external dns")
            resolve({
                domain: domain,
                ip: resolvedIPs[0],
                ttl: 300
            });
        })
    } catch (error) {
        // console.log(error)
        throw new Error(error.code)
    }
}

export default fetchIP6;