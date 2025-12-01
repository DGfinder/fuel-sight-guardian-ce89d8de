# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Fuel Sight Guardian seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Email**: [hayden@stevemacs.com.au](mailto:hayden@stevemacs.com.au)

Please include the following information in your report:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fixes (optional)

### What to Expect

| Timeline | Action |
|----------|--------|
| 48 hours | Initial acknowledgment of your report |
| 7 days | Assessment and triage for critical vulnerabilities |
| 30 days | Fix deployed for confirmed vulnerabilities |

### Scope

The following are in scope for security reports:
- Authentication and authorization bypasses
- SQL injection or data exposure
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Remote code execution
- Sensitive data exposure
- Access control violations

### Out of Scope

- Denial of service attacks
- Social engineering
- Physical security issues
- Third-party services not under our control

## Security Measures

This application implements the following security controls:

- **Authentication**: Supabase Auth with JWT tokens
- **Authorization**: Role-Based Access Control (RBAC)
- **Data Protection**: Row-Level Security (RLS) on all sensitive tables
- **Audit Logging**: Comprehensive audit trail with 7-year retention
- **Secret Scanning**: Gitleaks integration in CI/CD pipeline
- **Error Monitoring**: Sentry integration for security event tracking
- **Input Validation**: Zod schema validation on all inputs

## Responsible Disclosure

We kindly ask that you:
- Give us reasonable time to fix the issue before public disclosure
- Avoid accessing or modifying data that doesn't belong to you
- Act in good faith to avoid privacy violations and data destruction

We will:
- Not pursue legal action against researchers who follow this policy
- Work with you to understand and resolve the issue quickly
- Credit you in our security acknowledgments (if desired)

## Contact

For security inquiries: [hayden@stevemacs.com.au](mailto:hayden@stevemacs.com.au)
