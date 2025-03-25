function expandIPv6(ipv6) {
    const parts = ipv6.split(":"); // Split into hextets
    const missing = 8 - parts.filter(p => p.length > 0).length; // Find missing hextets

    // Replace "::" with correct number of "0000"
    return ipv6.replace("::", ":" + "0:".repeat(missing)).split(":").map(part => part.padStart(4, "0"));
}

export function ipv6ToBuffer(ipv6) {
    const hextets = expandIPv6(ipv6); // Expand to full form
    const buffer = Buffer.alloc(16); // IPv6 is always 16 bytes

    hextets.forEach((hextet, i) => {
        const num = parseInt(hextet, 16); // Convert hex string to number
        buffer.writeUInt16BE(num, i * 2); // Write as 16-bit (2 bytes) in Big Endian
    });

    return buffer;
}