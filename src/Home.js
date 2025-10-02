import React from 'react';
import './Home.css';
import { useKeycloak } from '@react-keycloak/web';

// Import all images from assets/img folder
import qiOverviewImage from './assets/img/qi-overview.png';
import adrienImage from './assets/img/adrien.jpg';
import valentinImage from './assets/img/valentin.jpg';
import lluisImage from './assets/img/lluis.jpg';
import johnImage from './assets/img/john.jpg';
import marioImage from './assets/img/mario.jpg';
import vincentImage from './assets/img/vincent.jpg';
import jakubImage from './assets/img/jakub.jpg';
import haslerImage from './assets/img/hasler.png';
import lundinImage from './assets/img/lundin.png';
import kfsLogo from './assets/img/KFS_Logo.png';
import snsfLogo from './assets/img/snsf.png';
import sphnLogo from './assets/img/sphn-logo.png';
import chuvLogo from './assets/img/chuv.png';
import hessoLogo from './assets/img/hesso.png';
import hesavLogo from './assets/img/hesav.png';
import medgiftLogo from './assets/img/medgift.png';


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
                <p className="hero-subtitle">A One-Stop Tool for Clinical Radiomics Research</p>
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
              <li className="nav-item">
                <a href="#publications" className="nav-link">Publications</a>
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
                <p>
                  <img src={qiOverviewImage} alt="QuantImage v2" title="QuantImage v2 - Overview" />
                </p>
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
                  Abler, D., Schaer, R., Oreiller, V., Verma, H., Reichenbach, J., Aidonopoulos, O., ... & Depeursinge, A. (2023). QuantImage v2: a comprehensive and integrated physician-centered cloud platform for radiomics and machine learning research. <em>European Radiology Experimental</em>, <strong>7</strong>(1), 16. 
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
                  QuantImage v2 is developed by the <strong><a href="https://medgift.hevs.ch/wordpress/" target="_blank" rel="noopener noreferrer">MedGIFT</a></strong> group at the University of Applied Sciences 
                  and Arts Western Switzerland (HES-SO Valais-Wallis) in collaboration with different partners in Switzerland.
                </p>
              </div>
              
              <h3>Core Team</h3>
              <table className="team-table">
                <tr>
                  <td valign="top"><img src={adrienImage} alt="Adrien Depeursinge" className="team-photo" /></td>
                  <td valign="top"><img src={vincentImage} alt="Vincent Andrearczyk" className="team-photo" /></td>
                  <td valign="top"><img src={jakubImage} alt="Jakub Mlynar" className="team-photo" /></td>
                  <td valign="top"><img src={lluisImage} alt="Lluis Borras Ferris" className="team-photo" /></td>
                  <td valign="top"><img src={valentinImage} alt="Valentin Oreiller" className="team-photo" /></td>
                </tr>
                <tr>
                  <td>
                    <div className="team-name">
                      Adrien Depeursinge
                      <span className="team-institution">(HEVS & CHUV)</span>
                    </div>
                  </td>
                  <td>
                    <div className="team-name">
                      Vincent Andrearczyk
                      <span className="team-institution">(HEVS)</span>
                    </div>
                  </td>
                  <td>
                    <div className="team-name">
                      Jakub Mlynar
                      <span className="team-institution">(HEVS)</span>
                    </div>
                  </td>
                  <td>
                    <div className="team-name">
                      Lluís Borràs Ferrís
                      <span className="team-institution">(HEVS)</span>
                    </div>
                  </td>
                  <td>
                    <div className="team-name">
                      Valentin Oreiller
                      <span className="team-institution">(HEVS)</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td valign="top"><img src={johnImage} alt="John O. Prior" className="team-photo" /></td>
                  <td valign="top"><img src={marioImage} alt="Mario Jreige" className="team-photo" /></td>
                </tr>
                <tr>
                  <td>
                    <div className="team-name">
                      John O. Prior
                      <span className="team-institution">(CHUV)</span>
                    </div>
                  </td>
                  <td>
                    <div className="team-name">
                      Mario Jreige
                      <span className="team-institution">(CHUV)</span>
                    </div>
                  </td>
                </tr>
              </table>
              
              <h3>Collaborations</h3>
              <div className="content-text">
                <ul>
                  <li>Florian Evéquoz <span className="affiliation">(HEVS)</span></li>
                  <li>Stephanie Tanadini-Lang <span className="affiliation">(USZ)</span></li>
                  <li>Ricardo Ribeiro <span className="affiliation">(HESAV)</span></li>
                  <li>Mélanie Champendal <span className="affiliation">(HESAV)</span></li>
                  <li>Naïk Vietti-Violi <span className="affiliation">(CHUV)</span></li>
                  <li>Clarisse Dromain <span className="affiliation">(CHUV)</span></li>
                  <li>Jonas Richiardi <span className="affiliation">(CHUV)</span></li>
                  <li>Vincent Dunet <span className="affiliation">(CHUV)</span></li>
                </ul>
              </div>
              
              <h3>Past Members</h3>
              <div className="content-text">
                <ul>
                  <li>Daniel Abler</li>
                  <li>Roger Schaer</li>
                  <li>Thomas Vetterli</li>
                </ul>
              </div>
              
              <div className="logo-container">
                <img src={chuvLogo} alt="CHUV" className="logo" />
                <img src={hessoLogo} alt="HES-SO" className="logo" />
                <img src={hesavLogo} alt="HESAV" className="logo" />
                <img src={medgiftLogo} alt="MedGIFT" className="logo" />
              </div>
            </div>
          </section>

          {/* Publications Section */}
          <section id="publications" className="content-section">
            <div className="container">
              <h2>Publications</h2>
              <div className="content-text">
                <p>
                  Research publications related to QuantImage v2 and its applications in clinical radiomics:
                </p>
                <ul className="publications-list">
                  <li>
                    Tartari, C., Porões, F., Schmidt, S., Abler, D., Vetterli, T., Depeursinge, A., ... & Jreige, M. (2025). MRI and CT radiomics for the diagnosis of acute pancreatitis. <em>European Journal of Radiology Open</em>, <strong>14</strong>, 100636. 
                    <a href="https://doi.org/10.1016/j.ejro.2025.100636" target="_blank" rel="noopener noreferrer">
                      https://doi.org/10.1016/j.ejro.2025.100636
                    </a>
                  </li>
                  <li>
                    Perriraz, J., Abler, D., Salvioni Chiabotti, P., Hall, C., Lejay, N., Kurian, G. K., ... & Jreige, M. (2025). A radiomics-based analysis of functional dopaminergic scintigraphic imaging for the diagnosis of dementia with Lewy bodies. <em>Neurodegenerative Diseases</em>. 
                    <a href="https://doi.org/10.1159/000547261" target="_blank" rel="noopener noreferrer">
                      https://doi.org/10.1159/000547261
                    </a>
                  </li>
                  <li>
                    Mlynář, J., Depeursinge, A., Prior, J. O., Schaer, R., Martroye de Joly, A., & Evéquoz, F. (2024). Making sense of radiomics: insights on human–AI collaboration in medical interaction from an observational user study. <em>Frontiers in Communication</em>, <strong>8</strong>, 1234987. 
                    <a href="https://doi.org/10.3389/fcomm.2023.1234987" target="_blank" rel="noopener noreferrer">
                      https://doi.org/10.3389/fcomm.2023.1234987
                    </a>
                  </li>
                  <li>
                    Mlynář, J., Schaer, R., Depeursinge, A., Abler, D., Jreige, M., Prior, J. O., & Evéquoz, F. (2024). Design implications of repurposing a radiomics research platform for education: the case of QuantImage v2. <em>Proceedings of Computer Assisted Radiology and Surgery (CARS 2024)</em>. 
                    <a href="https://publications.hevs.ch/index.php/publications/show/3092" target="_blank" rel="noopener noreferrer">
                      https://publications.hevs.ch/index.php/publications/show/3092
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Support & Funding Section */}
          <section id="funding" className="content-section">
            <div className="container">
              <h2>Support & Funding</h2>
              <div className="content-text">
                <p>Research and development of QuantImage v2 was supported by:</p>
              </div>
              <div className="logo-container">
                <img src={snsfLogo} alt="SNSF" className="logo" />
                <img src={sphnLogo} alt="SPHN" className="logo" />
                <img src={kfsLogo} alt="Swiss Cancer Research" className="logo" />
                <img src={lundinImage} alt="Lundin Family Brain Tumour Research Centre" className="logo" />
                <img src={haslerImage} alt="Hasler" className="logo" />
              </div>
            </div>
          </section>

        </main>
      </div>
    </>
  );
}

export default Home;
