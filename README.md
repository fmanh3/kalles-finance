# Kalles Buss: Finance Domain (`kalles-finance`)

## Overview
This repository contains the Financial domain for Kalles Buss, focused on revenue generation, compliance, and automated accounting.

### Subdomains Handled Here (MVP Focus):
1. **Billing Engine:** The rules engine that translates operational events (`TrafficDeviation`, `RouteCompleted`) into financial claims based on customer contracts (e.g., SL).
2. **Accounts Receivable (AR):** Manages outbound invoices and automated payment matching via Bank Gateway integration.
3. **General Ledger (GL):** The immutable double-entry bookkeeping engine that observes the event bus and records the financial truth.

## Development Guide

### Prerequisites
* Python 3.11+
* `uv` or `poetry` for dependency management
* Google Cloud SDK (for Pub/Sub emulation)

### Local Setup
*(To be populated: Instructions on how to install dependencies, e.g., `uv sync`)*

### Testing
*(To be populated: Instructions on running `pytest` and local GCP emulators)*

### Deployment
*(To be populated: Terraform / Cloud Run CI/CD instructions)*
