# Enterprise AI Security & Compliance Matrix

This document details the **Enterprise AI Security & Compliance Matrix** for **MeetOnMemory**, establishing governance, cryptographic guarantees, tenant isolation models, and regulatory mapping across AI transcription, summarization, and vector search operations.

---

## 1. Governance & AI Security Principles

MeetOnMemory processes sensitive enterprise unstructured communication (audio recordings, meeting transcripts, automated summaries, decision trees, and organizational policies). To protect intellectual property and satisfy enterprise compliance mandates, our AI infrastructure is architected on four non-negotiable principles:

1. **Zero Data Retention at AI Model Layer**: Vendor processing agreements with enterprise LLM providers guarantee zero payload storage after response synthesis.
2. **Strict Multi-Tenant Vector Partitioning**: Search embeddings are indexed with non-fungible namespace boundaries at the vector database tier.
3. **No Model Training on Customer Transcripts**: Customer inputs and generated summaries are strictly isolated from model training pipelines.
4. **End-to-End Cryptographic Envelope**: TLS 1.3 in-transit enforcement combined with AES-256 storage-at-rest across database and media storage layers.

---

## 2. Enterprise AI Compliance Control Matrix

The matrix below maps MeetOnMemory's technical AI security controls to major global regulatory and security compliance frameworks:

| Control ID    | Control Category              | Technical Safeguard Description                                                                                            | Enforcement Mechanism                                                                                    | Framework Mapping                                        | Status       |
| :------------ | :---------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :------------------------------------------------------- | :----------- |
| **SEC-AI-01** | Zero Retention                | AI inference calls operate statelessly in-memory without persistent logging by LLM APIs.                                   | Enterprise developer agreements (Google Gemini API / OpenAI API) enforcing zero log retention.           | SOC 2 (CC6.1, CC6.6), GDPR (Art. 28), ISO 27001 (A.12.1) | **Enforced** |
| **SEC-AI-02** | Model Non-Training            | Customer transcripts, action items, and summaries are explicitly excluded from model training/fine-tuning.                 | Opt-out headers & enterprise contractual zero-training clauses.                                          | SOC 2 (CC6.1), GDPR (Art. 5), HIPAA (§ 164.502), CCPA    | **Enforced** |
| **SEC-AI-03** | Vector Namespace Isolation    | Embeddings stored in Pinecone are strictly segregated by `Organization ID` namespaces.                                     | Hardened query predicate filters injected at vector retrieval layer (`server/services/vectorSearch.js`). | SOC 2 (CC6.1, CC6.3), ISO 27001 (A.9.4), FedRAMP         | **Enforced** |
| **SEC-AI-04** | In-Transit Encryption         | All API payloads between client, backend microservices, and AI provider endpoints use TLS 1.3.                             | Strict HSTS, TLS 1.3 enforcement, and TLS termination proxies.                                           | SOC 2 (CC6.7), HIPAA (§ 164.312(e)), ISO 27001 (A.13.2)  | **Enforced** |
| **SEC-AI-05** | At-Rest Encryption            | Meeting transcripts, audio blobs, and vector indexes encrypted with AES-256.                                               | Cloud KMS managed key rotation and MongoDB Atlas / AWS S3 default encryption.                            | SOC 2 (CC6.1), HIPAA (§ 164.312(a)), GDPR (Art. 32)      | **Enforced** |
| **SEC-AI-06** | Granular RBAC & ACL           | AI feature access (summaries, debriefs, smart search) checked against tenant role permissions.                             | Backend middleware evaluation (`roleCheck`, `customRoleController`, `rbacPermissions.js`).               | SOC 2 (CC6.1, CC6.2), ISO 27001 (A.9.2), CCPA            | **Enforced** |
| **SEC-AI-07** | Audit Logging & Tracing       | Every AI inference request logs structured metadata (Request ID, Org ID, Token Count, Response Status) with PII redaction. | Redacted JSON logger (`middleware/requestContext.js`) with 90-day WORM retention.                        | SOC 2 (CC7.2), HIPAA (§ 164.312(b)), ISO 27001 (A.12.4)  | **Enforced** |
| **SEC-AI-08** | Prompt Budgeting & Truncation | Bounds prompt size to prevent context overflow or denial-of-service, chunking long meetings gracefully.                    | `chunkTextByBudget` and resilience backoff in `server/utils/aiResilience.js`.                            | SOC 2 (CC7.1), ISO 27001 (A.12.1)                        | **Enforced** |
| **SEC-AI-09** | Sub-Processor Transparency    | Maintain transparent, audited directory of third-party processing vendors.                                                 | Publicly accessible vendor register with SOC 2 / ISO 27001 certification requirements.                   | GDPR (Art. 28), CCPA, SOC 2 (CC9.2)                      | **Enforced** |
| **SEC-AI-10** | Data Portability & Purging    | "Right to be forgotten" purges database records, stored media, and vector embeddings simultaneously.                       | Organization purge worker removing MongoDB docs and Pinecone namespace nodes.                            | GDPR (Art. 17), CCPA (§ 1798.105), ISO 27001 (A.8.3)     | **Enforced** |

---

## 3. Data Flow & Boundary Isolation Architecture

```mermaid
graph TD
    Client["Client Browser / Mobile App"] -->|TLS 1.3 + JWT Token| API["MeetOnMemory API Gateway"]

    subgraph AppBoundary ["Trust Boundary: MeetOnMemory Infrastructure"]
        API --> Auth["RBAC & ACL Validation Middleware"]
        Auth --> Context["Request Context & Audit Redactor"]
        Context --> Buffer["Prompt Budgeter & Text Chunker"]

        Buffer -->|Org Namespace Query| Pinecone["Pinecone Vector DB (Isolated Namespace)"]
        Buffer -->|AES-256 Encrypted| Mongo["MongoDB Atlas (Encrypted at Rest)"]
    end

    subgraph AIVendorBoundary ["Vendor Trust Boundary: Enterprise AI API"]
        Buffer -->|TLS 1.3 REST Request (Zero Retention)| Gemini["Google Gemini API (In-Memory Processing)"]
        Gemini -->|Structured JSON Response| Buffer
    end

    Pinecone -->|Matched Vectors| Buffer
```

---

## 4. Sub-Processor Security Compliance

MeetOnMemory engages sub-processors under rigorous Data Processing Addendums (DPAs) that align with GDPR Article 28 and SOC 2 Trust Services Criteria:

| Sub-Processor                 | Role / Function                   | Data Transferred                     | Security Certifications                   | Retention Policy             |
| :---------------------------- | :-------------------------------- | :----------------------------------- | :---------------------------------------- | :--------------------------- |
| **Google Cloud (Gemini API)** | LLM Transcription & Summarization | Meeting transcript text chunks       | SOC 2 Type II, ISO 27001, HIPAA BAA Ready | 0 Days (In-Memory Transient) |
| **Pinecone Systems**          | Vector Database for Smart Search  | Anonymized vector embeddings         | SOC 2 Type II, ISO 27001                  | Customer Account Lifecycle   |
| **MongoDB Atlas**             | Primary Database Storage          | Account data, meeting metadata       | SOC 2 Type II, ISO 27001, HIPAA BAA Ready | Encrypted Persistent         |
| **Amazon Web Services (AWS)** | Media Storage & Compute Host      | Raw audio/video files, static assets | SOC 2 Type II, ISO 27001, FedRAMP High    | Customer Account Lifecycle   |

---

## 5. Continuous Verification & Auditability

Enterprise customers can verify compliance through:

1. **Real-time Health & Readiness Probes**: `/health/ready` and `/health/live` endpoints verifying database, encryption, and worker readiness.
2. **RBAC Explorer**: `/admin` portal permission matrix inspector verifying role boundaries.
3. **Audit Log Exports**: Structured JSON logs tracking administrative actions, security configuration edits, and data export requests.
