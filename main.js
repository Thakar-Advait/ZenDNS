import * as dgram from "dgram";
import { encode, decode } from "dns-packet";
import { Resolver } from "dns/promises"
import DNSHeader from "./src/dns/header.js";
import DNSQuestion from "./src/dns/question.js";
import DNSAnswer, { TYPE_MAP } from "./src/dns/answer.js";
import { connectDb } from "./src/db/index.js";
import fetchIP4 from "./src/utils/fetchIP4.js";
import fetchIP6 from "./src/utils/fetchIP6.js";
import fetchNS from "./src/utils/fetchNS.js";
import fetchCname from "./src/utils/fetchCName.js";
import { refuesedQuesBuffer } from "./src/utils/refusedQues.js";
import dotenv from "dotenv";

dotenv.config({
    path: "./.env"
})

connectDb()
    .then(async ({ redisClient }) => {
        const server = dgram.createSocket("udp4");

        server.on("message", async (mssg, rminfo) => {
            // Decode the received DNS query
            const decoded = decode(mssg);
            const questions = decoded.questions;
            try {
                // console.log(`Received data from ${rminfo.address}:${rminfo.port}`);
                // console.log(decoded)

                // Construct response header (do NOT mutate defaultHeader)
                const responseHeader = {
                    id: decoded.id,
                    qr: 1, // Response flag
                    opcode: decoded.opcode,
                    aa: 0,
                    tc: 0,
                    rd: decoded.flag_rd === true ? 1 : 0, // `rd` is already a boolean in dns-packet
                    ra: 1,
                    z: 0,
                    rcode: "NOERROR",
                    qdcount: decoded.questions.length,
                    ancount: 1, // No answer for now
                    arcount: 0,
                    nscount: 0
                };

                const ques = questions.map((q) => {
                    return {
                        name: q.name,
                        type: q.type,
                        classCode: q.class
                    }
                })
                // console.log(ques)

                // Generate header buffer
                const headerBuffer = DNSHeader.write(responseHeader);
                // console.log(headerBuffer);

                const questionBuffer = DNSQuestion.write(ques);
                // console.log(questionBuffer);

                // Generate answer buffer
                const answers = await Promise.all(questions.map(async (q) => {
                    const name = q.name;
                    const type = q.type;
                    const classCode = q.class;

                    const answer = {}
                    switch (type) {
                        case "A":
                            const { ip: IP4, ttl: ttlIP4, domain: domainIP4 } = await fetchIP4(name);

                            answer.name = domainIP4;
                            answer.type = type;
                            answer.classCode = classCode;
                            answer.ttl = ttlIP4;
                            answer.rdata = IP4;

                            return answer
                        case "AAAA":
                            const { ip: IP6, ttl: ttlIP6, domain: domainIP6 } = await fetchIP6(name);

                            answer.name = domainIP6;
                            answer.type = type;
                            answer.classCode = classCode;
                            answer.ttl = ttlIP6;
                            answer.rdata = IP6;

                            return answer
                        case "NS":
                            const { domain: domainNS, server: serverNS, ttl: ttlNS } = await fetchNS(name);

                            answer.name = domainNS;
                            answer.type = type;
                            answer.classCode = classCode;
                            answer.ttl = ttlNS;
                            answer.rdata = serverNS;

                            return answer
                        
                        case "CNAME": 
                            const { domain: domainCname, cname: newCname, ttl: ttlCname  } = await fetchCname(name);
                            // console.log({domainCname, newCname, ttlCname})
                            answer.name = domainCname;
                            answer.type = type;
                            answer.classCode = classCode;
                            answer.ttl = ttlCname;
                            answer.rdata = newCname;

                            return answer
                        default:
                            console.log(`Unknown type: ${type}`)
                    }
                }))
                const answerBuffer = DNSAnswer.write(answers);
                // console.log(answerBuffer)

                // Reconstruct full DNS response (Header + Questions)
                const responsePacket = Buffer.concat([headerBuffer, questionBuffer, answerBuffer]);

                // Send response back
                server.send(responsePacket, rminfo.port, rminfo.address);

            } catch (error) {
                console.log(`Error processing DNS request: ${error}`);
                // console.log(error.message)

                let rcode;
                switch (error.message) {
                    case "ENOTFOUND":
                        rcode = "NXDOMAIN"
                        break;
                    
                    case "REFUSED":
                        rcode = "REFUSED"
                        break;
                    
                    case "NODATA":
                        rcode = "NOERROR"
                        break;
                    default:
                        console.log(error)
                        rcode = "SERVFAIL"
                        break;
                }
                // Construct error header
                const errorHeader = {
                    id: decoded.id,
                    qr: 1, // Response flag
                    opcode: decoded.opcode,
                    aa: 0,
                    tc: 0,
                    rd: decoded.flag_rd === true ? 1 : 0, // `rd` is already a boolean in dns-packet
                    ra: 1,
                    z: 0,
                    rcode: rcode,
                    qdcount: decoded.questions.length,
                    ancount: 0, // No answer for now
                    arcount: 0,
                    nscount: 0
                };

                const questions = decoded.questions;
                const ques = questions.map((q) => {
                    return {
                        name: q.name,
                        type: q.type,
                        classCode: q.class
                    }
                })
                // console.log(ques)

                // Generate header buffer
                const headerBuffer = DNSHeader.write(errorHeader);
                // console.log(headerBuffer);

                const questionBuffer = refuesedQuesBuffer(ques);
                // console.log(questionBuffer);

                const errorPacket = Buffer.concat([headerBuffer, questionBuffer]);
                server.send(errorPacket, rminfo.port, rminfo.address);
            }
        });

        server.bind(process.env.SERVER_PORT, () => {
            console.log(`DNS server started on port 53`);
        });
    })
    .catch((err) => {
        console.log(`Something went wrong while connecting to DB: ${err}`)
    })


