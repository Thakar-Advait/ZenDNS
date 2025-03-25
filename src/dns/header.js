import { z } from "zod";

const OPCODE_MAP = {
    QUERY: 0,
    IQUERY: 1,
    STATUS: 2
};

const RCODE_MAP = {
    NOERROR: 0,
    FORMERR: 1,
    SERVFAIL: 2,
    NXDOMAIN: 3,
    NOTIMP: 4,
    REFUSED: 5
};

const DNSHeaderSchema = z.object({
    id: z.number(),
    qr: z.number().min(0).max(1), // QR is 1-bit (0 or 1)
    opcode: z.enum(["QUERY", "IQUERY", "STATUS"]),
    aa: z.number().min(0).max(1), // AA is 1-bit
    tc: z.number().min(0).max(1), // TC is 1-bit
    rd: z.number().min(0).max(1), // RD is 1-bit
    ra: z.number().min(0).max(1), // RA is 1-bit
    z: z.number().min(0).max(7),  // Z is 3-bit (should always be 0)
    rcode: z.enum(["NOERROR", "FORMERR", "SERVFAIL", "NXDOMAIN", "NOTIMP", "REFUSED"]),
    qdcount: z.number(),
    ancount: z.number(),
    nscount: z.number(),
    arcount: z.number(),
});

class DNSHeader {
    static write(values) {
        // Validate input using Zod
        const parsedValues = DNSHeaderSchema.safeParse(values);
        if (!parsedValues.success) {
            throw new Error(`Validation failed: ${parsedValues.error.message}`);
        }

        const header = Buffer.alloc(12);

        // Convert opcode and rcode to numeric values
        const opcodeNum = OPCODE_MAP[values.opcode];
        const rcodeNum = RCODE_MAP[values.rcode];

        // Construct the 16-bit flags field
        const flags =
            (values.qr << 15) |    // 1-bit
            (opcodeNum << 11) |    // 4-bit
            (values.aa << 10) |    // 1-bit
            (values.tc << 9)  |    // 1-bit
            (values.rd << 8)  |    // 1-bit
            (values.ra << 7)  |    // 1-bit
            (values.z << 4)   |    // 3-bit (should be 0)
            (rcodeNum);            // 4-bit

        // Write values to the buffer
        header.writeUInt16BE(values.id, 0);
        header.writeUInt16BE(flags, 2);
        header.writeUInt16BE(values.qdcount, 4);
        header.writeUInt16BE(values.ancount, 6);
        header.writeUInt16BE(values.nscount, 8);
        header.writeUInt16BE(values.arcount, 10);

        return header;
    }
}

export default DNSHeader;
