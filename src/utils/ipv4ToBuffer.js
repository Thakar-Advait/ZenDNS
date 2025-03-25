export function ipv4ToBuffer(ipv4) {
    return Buffer.from(ipv4.split(".").map(Number)); // Convert IP to byte array
}