export function domainToBuffer(domain) {
    const labelParts = domain.split(".").map((label) => {
        return Buffer.from([label.length, ...Buffer.from(label)]);
    });

    const domainBuffer = Buffer.concat([...labelParts, Buffer.from([0])]); // Null-terminated
    return domainBuffer;
}