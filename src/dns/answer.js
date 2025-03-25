import { z } from "zod";
import { ipv6ToBuffer } from "../utils/ipv6ToBuffer.js";
import { ipv4ToBuffer } from "../utils/ipv4ToBuffer.js";
import { domainToBuffer } from "../utils/domainToBuffer.js";

export const TYPE_MAP = {
    A: 1,
    NS: 2,
    AAAA: 28,
    CNAME: 5
};

const CLASS_MAP = {
    IN: 1
};

// Define schema for validation
const DNSAnswerSchema = z.object({
    name: z.string(),
    type: z.enum(["A", "NS", "AAAA", "CNAME"]), // Only allow "A", "AAAA", and "NS" types
    classCode: z.literal("IN"),
    ttl: z.number(),
    rdata: z.string()
});

class DNSAnswer {
    static write(answers) {
        try {
            answers.forEach((answer) => {
                const parsedValues = DNSAnswerSchema.safeParse(answer);
                if (!parsedValues.success) {
                    // console.log(`Validation failed: ${parsedValues.error.message}`);
                    throw new Error("REFUSED")
                }
            });

            return Buffer.concat(answers.map((answer) => {
                const { name, type, classCode, ttl, rdata } = answer;

                // Encode the domain name correctly
                const nameParts = name.split(".").map((label) => {
                    return Buffer.from([label.length, ...Buffer.from(label)]);
                });

                const nameBuffer = Buffer.concat([...nameParts, Buffer.from([0])]); // Null-terminated

                // Convert type and class to 16-bit numbers
                const typeAndClass = Buffer.alloc(4);
                typeAndClass.writeUInt16BE(TYPE_MAP[type], 0);
                typeAndClass.writeUInt16BE(CLASS_MAP[classCode], 2);

                // TTL (32-bit)
                const ttlBuffer = Buffer.alloc(4);
                ttlBuffer.writeUInt32BE(ttl, 0);

                // Convert `rdata` (IPs) to a buffer
                let dataBuffer;
                if (type === "A") {
                    dataBuffer = ipv4ToBuffer(rdata); 
                }
                else if (type === "AAAA") {
                    dataBuffer = ipv6ToBuffer(rdata);
                }
                else if (type === "NS") {
                    dataBuffer = domainToBuffer(rdata);
                }
                else if (type === "CNAME") {
                    dataBuffer = domainToBuffer(rdata);
                }

                // Data length (16-bit)
                const dataLengthBuffer = Buffer.alloc(2);
                dataLengthBuffer.writeUInt16BE(dataBuffer.length, 0);

                return Buffer.concat([
                    nameBuffer,
                    typeAndClass,
                    ttlBuffer,
                    dataLengthBuffer,
                    dataBuffer
                ]);
            }));
        } catch (error) {
            // console.log(`Error processing DNS request: ${error}`);
            throw new Error(error)
        }
    }
}

export default DNSAnswer;
