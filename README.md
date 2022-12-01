**# QuantImage v2 - Frontend

## Context

This repository is part of the QuantImage v2 platform, which includes the following repositories:

- https://github.com/medgift/quantimage2-setup - Setup script for the platform
- https://github.com/medgift/quantimage2-frontend - Frontend in React
- https://github.com/medgift/quantimage2_backend - Backend in Python
- https://github.com/medgift/quantimage2-kheops - Custom configuration for the [Kheops](https://kheops.online) platform

## Project Structure

### Docker

The project uses Docker for easy build & deployment, using the following files :

- `Dockerfile` : Installs the project dependencies and starts the development server
- `Dockerfile.prod` : Builds the production version of the app and serves it using nginx
- `docker-compose.yml` : Base Docker Compose file
- `docker-compose.override.yml` : Override file for local development, exposing port 3000 & mapping the source directory to the container.
- `docker-compose.local.yml` : File for testing the production build locally without Traefik
- `docker-compose.vm.yml` : File for the [QuantImage v2 VM](https://medgift.github.io/quantimage-v2-info/#getting-started), restarting the container automatically on reboot or crash**
- `docker-compose.prod.yml` : Production file for use with Traefik

********### Code Structure********

```
│   App.js & all pages of the application
│
├───assets    : Images & Common options for charts
│
├───components : Reusable components that are part of pages
│
├───config     : Constants used for feature mapping, outcome fields etc.
│
├───context    : Global data for the app (User & Socket.IO)
│
├───dicom      : DICOM field mappings (name -> tag)
│
├───services   : Functions for making calls to the Kheops & Backend APIs
|
└───utils      : Utility functions (feature mapping, parsing files, etc.)
```

> NOTE : This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).
