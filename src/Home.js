import React from 'react';
import './Home.css';
import { NavLink as RouterNavLink } from 'react-router-dom';

function Home() {
  return (
    <>
      <div>
        <header className="App-header">
          <h1 data-testid="welcome-page-header">QuantImage v2</h1>
        </header>
        <section id="extract-features">
          <h2>About</h2>
          <p>
            The QuantImage v2 platform allows{' '}
            <strong>extracting radiomics features</strong> from a cohort of
            patients, as well as{' '}
            <strong>
              creating, storing and visualizing curated feature collections
            </strong>{' '}
            based on the extracted data.
          </p>
          <p>
            Additionally, it enables users to{' '}
            <strong>initialize, traing and validate predictive models</strong>{' '}
            for both <strong>classification</strong> tasks (including various
            algorithms such as linear regression or random forests) and{' '}
            <strong>survival analysis</strong> using Cox models.
          </p>
          <p>
            The platform works together with the{' '}
            <a
              href="https://kheops.online"
              target="_blank"
              rel="noopener noreferrer"
            >
              Kheops
            </a>{' '}
            platform, which allows uploading, managing and sharing collections
            of medical images.
          </p>
          <h2>Demonstration</h2>
          <iframe
            width="640"
            height="360"
            src="https://www.youtube.com/embed/VCWANluZVsI"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="QuantImage v2 Demonstration Video"
          ></iframe>
          <h2>Get Started</h2>
          <p>
            Go to the <RouterNavLink to="/dashboard">Dashboard</RouterNavLink>{' '}
            tab to get started. Upload your patient cohort in Kheops then start
            extracting features.
          </p>
        </section>
      </div>
    </>
  );
}

export default Home;
