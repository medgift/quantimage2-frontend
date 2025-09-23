import React from 'react';
import './Home.css';
import { useKeycloak } from '@react-keycloak/web';

function Home() {
  const { keycloak, initialized } = useKeycloak();

  const handleLaunchApp = () => {
    if (keycloak && initialized) {
      if (keycloak.authenticated) {
        // Already authenticated, go to dashboard
        window.location.href = '/dashboard';
      } else {
        // Not authenticated, trigger login with redirect to dashboard
        keycloak.login({
          redirectUri: window.location.origin + '/dashboard'
        });
      }
    }
  };

  return (
    <>
      <div className="home-container">
        {/* Hero Header */}
        <header className="hero-section">
          <div className="container">
            <div className="hero-content">
              <div className="hero-text">
                <h1 data-testid="welcome-page-header" className="hero-title">
                  QuantImage v2
                </h1>
                <p className="hero-subtitle">No-code clinical radiomics research platform</p>
                <p className="hero-description">
                  Empowering physicians to play a leading role in clinical radiomics research
                </p>
              </div>
              <div className="hero-actions">
                <button onClick={handleLaunchApp} className="btn btn-primary">
                  <span role="img" aria-label="rocket">🚀</span> Launch App
                </button>
                <a href="https://github.com/medgift/quantimage2-setup" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                  View on GitHub
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* Main Navigation */}
        <nav className="main-nav">
          <div className="container">
            <ul className="nav-list">
              <li className="nav-item">
                <button onClick={handleLaunchApp} className="nav-link nav-launch">
                  <span role="img" aria-label="rocket">🚀</span> Launch App
                </button>
              </li>
              <li className="nav-item">
                <a href="#platform" className="nav-link">QuantImage v2</a>
              </li>
              <li className="nav-item">
                <a href="#getting-started" className="nav-link">Getting Started</a>
              </li>
              <li className="nav-item">
                <a href="#team" className="nav-link">Team</a>
              </li>
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <main className="main-content">
          
          {/* Platform Overview */}
          <section id="platform" className="content-section">
            <div className="container">
              <h2>QuantImage v2 Platform</h2>
              <div className="content-text">
                <p>
                  QuantImage v2 (QI2) is an open-source web-based platform for no-code clinical radiomics research. 
                  It has been developed with the aim to empower physicians to play a leading role in clinical 
                  radiomics research. We believe that tighter involvement of domain experts is critical to ensuring 
                  the clinical relevance of radiomics research and will lead to the development of better 
                  interpretable and more generalizable radiomics models.
                </p>
              </div>
              
              <div className="citation-card">
                <h3>Citing QuantImage v2</h3>
                <p><strong>If you are using QuantImage v2 in your research, please cite the following publication:</strong></p>
                <p className="citation">
                  Abler, D., Schaer, R., Oreiller, V. <em>et al.</em> QuantImage v2: a comprehensive and integrated 
                  physician-centered cloud platform for radiomics and machine learning research. <em>Eur Radiol Exp</em> <strong>7</strong>, 16 (2023). 
                  <a href="https://doi.org/10.1186/s41747-023-00326-z" target="_blank" rel="noopener noreferrer">
                    https://doi.org/10.1186/s41747-023-00326-z
                  </a>
                </p>
              </div>
            </div>
          </section>

          {/* Getting Started Section */}
          <section id="getting-started" className="content-section">
            <div className="container">
              <h2>Getting Started</h2>
              <div className="content-text">
                <p>
                  QI2 supports <strong>all steps of a typical radiomics study workflow</strong>:
                </p>
              </div>
              
              <div className="workflow-grid">
                <div className="workflow-item">
                  <div className="workflow-icon">
                    <span role="img" aria-label="people">👥</span>
                  </div>
                  <h3>Patient Cohorts</h3>
                  <p>Create and manage patient cohorts with comprehensive metadata tracking</p>
                </div>
                <div className="workflow-item">
                  <div className="workflow-icon">
                    <span role="img" aria-label="microscope">🔬</span>
                  </div>
                  <h3>Feature Extraction</h3>
                  <p>Extract radiomics features from regions of interest (ROIs) of CT/PET/MR images</p>
                </div>
                <div className="workflow-item">
                  <div className="workflow-icon">
                    <span role="img" aria-label="chart">📊</span>
                  </div>
                  <h3>Feature Exploration</h3>
                  <p>Explore and select features using advanced visualization tools</p>
                </div>
                <div className="workflow-item">
                  <div className="workflow-icon">
                    <span role="img" aria-label="robot">🤖</span>
                  </div>
                  <h3>Machine Learning</h3>
                  <p>Create and evaluate ML models for classification and survival tasks</p>
                </div>
              </div>

              <div className="clinical-features">
                <h3>Built for Clinical Environment</h3>
                <p>Furthermore, QI2 was designed to <strong>integrate well into the clinical environment</strong>:</p>
                <ul>
                  <li>Providing PACS-like functionality for managing imaging studies</li>
                  <li>Ubiquitous access through a web portal</li>
                  <li>Guiding the user through the radiomics analysis process</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Team Section */}
          <section id="team" className="content-section">
            <div className="container">
              <h2>Team</h2>
              <div className="content-text">
                <p>
                  QuantImage v2 is developed by the <strong>MedGIFT</strong> group at the University of Applied Sciences 
                  and Arts Western Switzerland (HES-SO Valais-Wallis) in collaboration with partners from the 
                  Swiss Personalized Health Network (SPHN).
                </p>
              </div>
              <div className="partner-logos">
                <img src="/assets/img/sphn-logo.png" alt="SPHN Logo" className="partner-logo" />
                <img src="/assets/img/fns-logo.png" alt="FNS Logo" className="partner-logo" />
              </div>
            </div>
          </section>

        </main>
      </div>
    </>
  );
}

export default Home;
