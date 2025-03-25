import { neon } from "@neondatabase/serverless"

const sql = neon('postgresql://DNS_owner:npg_WIX0wOe4ALKs@ep-tiny-resonance-a1m1roxb-pooler.ap-southeast-1.aws.neon.tech/DNS?sslmode=require')

const records = await sql.query("SELECT * FROM dns_records WHERE id = $1", [1])
console.log(records)
