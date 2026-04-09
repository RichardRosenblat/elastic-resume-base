# Architecture Pricing, Planning, and Scaling Report

## Resume Processing Pipeline

## Overview

This document outlines the cost analysis and scaling strategy for our new resume processing application. By leveraging a multi-service Google Cloud architecture, I have designed a pipeline that keeps baseline costs exceptionally low while ensuring high performance and graceful scalability. Below is a breakdown of our service utilization and the financial projections as our volume grows.

## Baseline Monthly Pricing Estimate (1,000 Resumes/Month)

For our initial rollout or standard internal usage (processing approximately 1,000 resumes monthly), the infrastructure operates almost entirely within Google Cloud’s free tiers.

| Service Component | Google Cloud Product | Free Tier Threshold | Estimated Monthly Cost |
| --- | --- | --- | --- |
| **Frontend SPA** | Firebase Hosting | 10 GB storage, 10 GB bandwidth/month | **$0.00** |
| **Authentication** | Firebase Auth (Google SSO) | 50,000 MAUs / Unlimited SSO | **$0.00** |
| **Gateway** | Cloud Run | 2M requests & 180k vCPU sec/month | **$0.00** |
| **Users API** | Cloud Run | Included in shared Cloud Run free tier | **$0.00** |
| **Ingestion Worker** | Cloud Run + Workspace APIs | Fits comfortably in Cloud Run free tier | **$0.00** |
| **A.I. Worker (Extractor)** | Vertex AI (Gemini 1.5 Flash) | N/A (Priced per 1M tokens) | **~$0.15** (Text-only) |
| **A.I. Worker (Embedder)** | Vertex AI (Text-Multilingual) | N/A (Priced per 1k chars) | **~$0.10** |
| **Search Base (FAISS)** | Cloud Run | FAISS index is in-memory; scaled to zero at low volumes | **$0.00** |
| **File Generator** | Cloud Run | Fits in Cloud Run free tier | **$0.00** |
| **Translation** | Cloud Translation API | First 500,000 characters/month free | **$0.00** (Protected by cache) |
| **Document OCR** | Cloud Vision API | First 1,000 pages/month free | **$0.00** |
| **DLQ Notifier** | Cloud Run + Pub/Sub + Firestore | 10 GB Pub/Sub messages/month free | **$0.00** |
| **PII Encryption** | Cloud KMS | 10,000 key operations/month free | **$0.00** |
| **Persistence** | Firestore | 50k reads, 20k writes, 20k deletes/day | **$0.00** |
| **Cloud Logging** | Cloud Logging | First 50 GB/month free | **$0.00** |

**Total Estimated Monthly Cost: ~$0.25**

By consolidating our microservices, eliminating the need for a custom Auth service, and strictly maximizing the Translation and Vision API free tiers, I have reduced our baseline infrastructure bill to roughly a quarter per month.

## Infrastructure Growth Mechanics

It is critical to understand exactly when our usage will exceed the free tier allowances. I have structured the system as a "pay-as-you-grow" model, meaning we only incur costs when driving tangible, high-volume business value.

1. **The Translation Threshold:** We receive 500,000 translated characters for free monthly. Because the File Generator implements an LFU-decay translation cache (backed by Firestore's `translation-cache` collection), we are unlikely to hit this limit at standard volumes. Once we exceed the cache's capacity at higher scales, standard pricing applies ($20 per 1 million characters).
2. **The Vision API Threshold:** We receive 1,000 free OCR pages per month. If user behavior shifts heavily toward scanned image-PDFs, we will eventually cross this limit, billing at $1.50 per 1,000 pages thereafter.
3. **The Search Base Warm-Up:** Once our FAISS index exceeds the optimal size for a fast cold start (projected around the 50,000 resume mark), I will configure the Search Base to `min-instances: 1`. This introduces a flat ~$5 to $15 monthly cost to ensure immediate query response times. Below this threshold the service can safely scale to zero between requests, rebuilding the index from Firestore on each cold start.

## Scaling Projections: 10x and 100x Scenarios

Because I grouped our compute workloads and implemented intelligent caching layers, the system degrades gracefully and remains highly cost-efficient even as volume explodes.

### Scenario A: 10x Scale (10,000 Resumes / Month)

At this tier, we support roughly 50–100 active recruiters querying the system daily. We begin to cross the initial free tier limits, but operational costs remain negligible.

| Service Component | Cost Driver at 10x Scale | Estimated Monthly Cost |
| --- | --- | --- |
| **Frontend & Auth** | Firebase stays well within free tiers. | **$0.00** |
| **Compute Layers** | Traffic slightly exceeds 180,000 free vCPU seconds (Gateway, Users API, Ingestor, File Generator, Doc Reader, DLQ Notifier). | **~$2.00** |
| **A.I. Extractor** | ~15M input / 5M output tokens processed. | **~$2.60** |
| **A.I. Embedder** | ~10M characters processed across fullText and skills embeddings. | **~$1.00** |
| **Search Base** | Index is ~30MB. Cold starts remain fast enough to scale to zero. | **$0.00** |
| **Translation** | Cache handles ~80%; ~1M new chars hit API. | **~$10.00** |
| **Document OCR** | Assuming 10% scanned (1,000 pages). Hits exact free limit. | **$0.00** |
| **PII Encryption** | ~60k KMS key operations (encrypt + decrypt across AI Worker, Search Base, File Generator). | **~$0.15** |
| **Persistence** | ~333 writes/day. Securely under the 20k free limit. | **$0.00** |

**Total Estimated Cost: ~$15.75 / month**

### Scenario B: 100x Scale (100,000 Resumes / Month)

At this enterprise level, we are operating a massive data pipeline supporting 500+ active users running thousands of vector searches daily. Sustained compute and API usage is required.

| Service Component | Cost Driver at 100x Scale | Estimated Monthly Cost |
| --- | --- | --- |
| **Frontend & Auth** | Still free (Firebase Auth allows 50k MAUs). | **$0.00** |
| **Compute Layers** | Sustained daily container usage across all Cloud Run services. | **~$25.00** |
| **A.I. Extractor** | ~150M input / 50M output tokens processed. | **~$26.00** |
| **A.I. Embedder** | ~100M characters processed across fullText and skills embeddings. | **~$10.00** |
| **Search Base** | Index is ~300MB. Requires `min-instances: 1` to stay warm. | **~$15.00** |
| **Translation** | Cache is highly mature, but volume requires ~4.5M billable chars. | **~$80.00** |
| **Document OCR** | Assuming 10% scanned (10k pages). 9k billed at $1.50/1k. | **~$13.50** |
| **PII Encryption** | ~600k KMS key operations (encrypt + decrypt). | **~$2.00** |
| **Persistence** | Reads begin to exceed 50k/day free tier due to UI usage. | **~$5.00** |

**Total Estimated Cost: ~$176.50 / month**

## Strategic Architectural Insights

At the 100x enterprise scale, the value of our upfront architectural decisions becomes apparent. Our current design yields three major strategic wins:

* **Translation Cache ROI:** A standard application translating millions of standard HR terms at this volume would generate a translation bill exceeding $1,000. The File Generator's LFU-decay translation cache (backed by Firestore's `translation-cache` collection) suppresses this to approximately $80.
* **Text-First AI Processing:** By extracting text prior to LLM processing, rather than sending heavy PDFs directly to a multimodal model, we reduced our AI overhead. Without this optimization, the 100x AI bill would be closer to $250 instead of the projected $26.
* **Elastic Search Provisioning:** The architecture is designed to transition from a "free" scale-to-zero model to a highly responsive, permanently warm enterprise search engine for just $15 a month by toggling a single configuration line (`min-instances: 1` on the Search Base Cloud Run service).
* **PII Encryption at Scale:** The Cloud KMS integration encrypts all personally identifiable fields (name, email, phone, address, CPF, RG) before they reach Firestore and decrypts them on demand in the Search Base and File Generator. This security layer adds approximately $2 to the 100x monthly bill — a negligible overhead for the data-protection guarantees it provides.

This pipeline is not just optimized for startup credits; it is a dynamically scaling architecture fully capable of supporting enterprise workloads for under $200 a month.
