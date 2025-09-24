import React from 'react';
import './Home.css';
import { useKeycloak } from '@react-keycloak/web';

// Import all images from assets/img folder
import adrienImage from './assets/img/adrien.jpg';
import danielImage from './assets/img/daniel.jpg';
import haslerImage from './assets/img/hasler.png';
import lluisImage from './assets/img/lluis.jpg';
import lundinImage from './assets/img/lundin.png';
import qiOverviewImage from './assets/img/qi-overview.png';
import rogerImage from './assets/img/roger.jpg';
import snsfLogo from './assets/img/snsf.png';
import sphnLogo from './assets/img/sphn-logo.png';
import valentinImage from './assets/img/valentin.jpg';

function Home() {
  const { keycloak, initialized } = useKeycloak();

  const handleLogIn = () => {
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
                <button onClick={handleLogIn} className="btn btn-primary">
                  Log in
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
                <a href="#platform" className="nav-link">QuantImage v2</a>
              </li>
              <li className="nav-item">
                <a href="#getting-started" className="nav-link">Get Involved</a>
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
                <img src={qiOverviewImage} alt="QuantImage v2" title="QuantImage v2 - Overview" />
                <h3>One-stop tool for clinical radiomics research</h3>
                <p>
                  To implement this vision, and different to most other radiomics softwares, QI2 supports all steps of a typical radiomics study workflow:
                </p>
                <ul>
                  <li>allowing the user to create patient cohorts,</li>
                  <li>extracting radiomics features from regions of interest (ROIs) of CT/PET/MR images,</li>
                  <li>exploring and selecting features using visualisation, as well as</li>
                  <li>creating and evaluating machine learning models for classification and survival tasks.</li>
                </ul>
                <p>
                  Furthermore, QI2 was designed to integrate well into the clinical environment:
                </p>
                <ul>
                  <li>providing PACS-like functionality for managing imaging studies,</li>
                  <li>ubiquitous access through a web portal, and</li>
                  <li>guiding the user through the radiomics analysis process.</li>
                </ul>
                
                <h3>Built upon established Open-Source components</h3>
                <p>
                  QI2 relies on established components for medical image management, radiomics feature computation and machine learning, including Kheops, an open-source web-based for managing collections of DICOM images, pyradiomics for feature extraction and scikit-learn / scikit-survival for machine learning model development and evaluation.
                </p>
                
                <h3>Overview</h3>
                <p>
                  The video below is an introduction to the QuantImage v2 radiomics research platform and its features:
                </p>
                <video style={{maxWidth: '832px', maxHeight: '832px'}} controls>
                  <source src='https://drive.switch.ch/index.php/s/3Tom8ZnIF8wl2r3/download' type='video/mp4' />
                  Video Not Supported
                </video>
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
              <h2>Get Involved</h2>
              <p>
                QuantImage v2 is an open-source project and we welcome contributions from the community. 
                Whether you are a developer, researcher, or clinician, there are many ways to get involved and help us improve the platform.
              </p>
              <div className="content-text">
                <h3>QuantImage v2 Source Code</h3>
                <h4>Setup Script (requires Docker & Git)</h4>
                <p>
                  To easily get started and create a running instance of the full platform (Kheops, QuantImage v2 Frontend & Backend, Keycloak, OHIF Viewer, etc.), clone the following repository and run the setup script as described in the README.md file:
                </p>
                <p>
                  <strong>Setup & Update Scripts</strong>: <a href="https://github.com/medgift/quantimage2-setup" target="_blank" rel="noopener noreferrer">https://github.com/medgift/quantimage2-setup</a>
                </p>
                
                <h4>GitHub Repositories</h4>
                <p>Here are the links for the various repositories the full platform consists of:</p>
                <ul>
                  <li><strong>QuantImage v2 Kheops configuration</strong>: <a href="https://github.com/medgift/quantimage2-kheops" target="_blank" rel="noopener noreferrer">https://github.com/medgift/quantimage2-kheops</a></li>
                  <li><strong>QuantImage v2 Backend & associated tools</strong>: <a href="https://github.com/medgift/quantimage2_backend" target="_blank" rel="noopener noreferrer">https://github.com/medgift/quantimage2_backend</a></li>
                  <li><strong>QuantImage v2 Frontend</strong>: <a href="https://github.com/medgift/quantimage2-frontend" target="_blank" rel="noopener noreferrer">https://github.com/medgift/quantimage2-frontend</a></li>
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
              
              <h3>Core Team</h3>
              <table className="team-table">
                <tr>
                  <td valign="top"><img src={adrienImage} alt="Adrien Depeursinge" className="team-photo" /></td>
                  <td valign="top"><img src={danielImage} alt="Daniel Abler" className="team-photo" /></td>
                  <td valign="top"><img src={rogerImage} alt="Roger Schaer" className="team-photo" /></td>
                  <td valign="top"><img src={valentinImage} alt="Valentin Oreiller" className="team-photo" /></td>
                  <td valign="top"><img src={lluisImage} alt="Lluis Borras Ferris" className="team-photo" /></td>
                </tr>
                <tr>
                  <td>
                    <a href="https://medgift.hevs.ch/wordpress/team/adrien-depeursinge/" target="_blank" rel="noopener noreferrer">Adrien Depeursinge</a>
                  </td>
                  <td>
                    <a href="https://medgift.hevs.ch/wordpress/team/daniel-abler/" target="_blank" rel="noopener noreferrer">Daniel Abler</a>
                  </td>
                  <td>
                    <a href="https://medgift.hevs.ch/wordpress/team/roger-schaer/" target="_blank" rel="noopener noreferrer">Roger Schaer</a>
                  </td>
                  <td>
                    <a href="https://medgift.hevs.ch/wordpress/team/valentin-oreiller/" target="_blank" rel="noopener noreferrer">Valentin Oreiller</a>
                  </td>
                  <td>
                    <a href="https://www.hevs.ch/en/collaborateurs/borras-ferris-207747" target="_blank" rel="noopener noreferrer">Lluís Borràs Ferrís</a>
                  </td>
                </tr>
              </table>
              
              <h3>Contributors</h3>
              <div className="content-text">
                <h4>CHUV</h4>
                <ul>
                  <li><a href="https://centrescancer.chuv.ch/specialiste/john-prior" target="_blank" rel="noopener noreferrer">Pr John O. Prior</a></li>
                  <li><a href="https://applicationspub.unil.ch/interpub/noauth/php/Un/UnPers.php?PerNum=1216661&LanCode=8" target="_blank" rel="noopener noreferrer">Dr Mario Jreige</a></li>
                </ul>
                
                <h4>HES-SO Valais</h4>
                <ul>
                  <li><a href="https://www.hevs.ch/en/collaborateurs/evequoz-1589" target="_blank" rel="noopener noreferrer">Dr Florian Evéquoz</a></li>
                </ul>
                
                <h4>USZ</h4>
                <ul>
                  <li><a href="https://www.usz.ch/team/stephanie-tanadini-lang" target="_blank" rel="noopener noreferrer">Dr Stephanie Tanadini-Lang</a></li>
                </ul>
              </div>
            </div>
          </section>

          {/* Support & Funding Section */}
          <section id="funding" className="content-section">
            <div className="container">
              <h2>Support & Funding</h2>
              <div className="content-text">
                <p>Research and development of QuantImage v2 was supported by</p>
              </div>
              <div className="funding-logos">
                <a href="https://snf.ch" target="_blank" rel="noopener noreferrer nofollow">
                  <img src={snsfLogo} alt="SNSF" />
                </a>
                <a href="https://sphn.ch" target="_blank" rel="noopener noreferrer nofollow">
                  <img src={sphnLogo} alt="SPHN" />
                </a>
                <a href="https://haslerstiftung.ch" target="_blank" rel="noopener noreferrer nofollow">
                  <img src={haslerImage} alt="Hasler" />
                </a>
                <a href="https://thelundingroup.com/brain-cancer-research/lundin-cancer-fund-overview/" target="_blank" rel="noopener noreferrer nofollow">
                  <img src={lundinImage} alt="Lundin Family Brain Tumour Research Centre" />
                </a>
              </div>
            </div>
          </section>

        </main>
      </div>
    </>
  );
}

export default Home;
