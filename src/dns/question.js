import { z } from "zod";

const CLASS_MAP = {
    IN: 1
}

const TYPE_MAP = {
    A: 1,
    NS: 2,
    AAAA: 28,
    CNAME: 5
}

const DNSQuestionSchema = z.object({
    name: z.string(),
    type: z.enum(["A", "NS", "AAAA", "CNAME"]),
    classCode: z.enum(["IN"])
})

class DNSQuestion {
    static write(questions) {
        try {
            questions.forEach((question) => {
                const parsedValues = DNSQuestionSchema.safeParse(question);
                if (!parsedValues.success) {
                    // console.log(`Validation failed: ${parsedValues.error.message}`);
                    throw new Error("REFUSED")
                }
            })

            return Buffer.concat(questions.map((question) => {
                const { name, type, classCode } = question;

                const nameStr = name.split(".").map((label) => {
                    return `${String.fromCharCode(label.length)}${label}`
                }).join("");

                const typeNum = TYPE_MAP[type];
                const classCodeNum = CLASS_MAP[classCode];

                const typeAndClass = Buffer.alloc(4);
                typeAndClass.writeUInt16BE(typeNum, 0);
                typeAndClass.writeUint16BE(classCodeNum, 2);

                return Buffer.concat([Buffer.from(nameStr + "\0", "binary"), Buffer.from(typeAndClass)]);
            }))

        } catch (error) {
            // console.error(error.message);
            throw new Error(error.message)
        }
    }
}

export default DNSQuestion;

// example.com    \07example\03com\0x  <label-length><label>...<null>