const REFUSED_CLASS_MAP = {
    IN: 1,    // Internet
    CS: 2,    // CSNET (Obsolete)
    CH: 3,    // CHAOS
    HS: 4,    // Hesiod
    ANY: 255  // Any Class
};

const REFUSED_TYPE_MAP = {
    A: 1,      // IPv4 Address done
    NS: 2,     // Name Server done
    CNAME: 5,  // Canonical Name done
    SOA: 6,    // Start of Authority
    PTR: 12,   // Pointer Record
    MX: 15,    // Mail Exchange
    TXT: 16,   // Text Record
    AAAA: 28,  // IPv6 Address done
    SRV: 33,   // Service Record
    NAPTR: 35, // Naming Authority Pointer
    OPT: 41,   // EDNS0 Option Record
    DS: 43,    // Delegation Signer (DNSSEC)
    RRSIG: 46, // DNSSEC Signature
    NSEC: 47,  // DNSSEC Next Secure Record
    DNSKEY: 48,// DNS Key Record
    CAA: 257   // Certification Authority Authorization
};


export function refuesedQuesBuffer(questions) {
    return Buffer.concat(questions.map((question) => {
        const { name, type, classCode } = question;

        const nameStr = name.split(".").map((label) => {
            return `${String.fromCharCode(label.length)}${label}`
        }).join("");

        const typeNum = REFUSED_TYPE_MAP[type];
        const classCodeNum = REFUSED_CLASS_MAP[classCode];

        const typeAndClass = Buffer.alloc(4);
        typeAndClass.writeUInt16BE(typeNum, 0);
        typeAndClass.writeUint16BE(classCodeNum, 2);

        return Buffer.concat([Buffer.from(nameStr + "\0", "binary"), Buffer.from(typeAndClass)]);
    }))
}