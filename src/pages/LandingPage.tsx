import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  Dna,
  FileSpreadsheet,
  Menu,
  Microscope,
  ShieldCheck,
  X,
} from 'lucide-react';
import { EcoDnaLogo } from '../components/EcoDnaLogo';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  isAuthenticated: boolean;
  onEnterWorkspace: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenAuth,
  isAuthenticated,
  onEnterWorkspace,
}) => {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', organization: '', message: '' });
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.includes('@') || contactForm.message.trim().length < 10) {
      setContactError('Please enter your name, a valid email address, and an inquiry message (at least 10 characters).');
      return;
    }
    setContactError(null);
    setContactSent(true);
    setContactForm({ name: '', email: '', organization: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-white text-[#0B221A]">
      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a href="#home" className="whitespace-nowrap shrink-0">
            <EcoDnaLogo variant="dark" size="md" />
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-700" aria-label="Primary">
            <a href="#home" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Home
            </a>
            <a href="#about" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              About
            </a>
            <a href="#features" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#research" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Research
            </a>
            <a href="#contact" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Contact
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-3 shrink-0">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onEnterWorkspace}
                className="px-4 py-2 bg-[#061B14] text-white text-sm font-medium rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Open Workspace
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="px-3.5 py-2 text-sm font-medium text-[#061B14] hover:text-emerald-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="px-4 py-2 bg-[#061B14] text-white text-sm font-medium rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Register
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenu((v) => !v)}
            className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenu && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3">
            <div className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              <a href="#home" onClick={() => setMobileMenu(false)} className="py-1.5">
                Home
              </a>
              <a href="#about" onClick={() => setMobileMenu(false)} className="py-1.5">
                About
              </a>
              <a href="#features" onClick={() => setMobileMenu(false)} className="py-1.5">
                Features
              </a>
              <a href="#research" onClick={() => setMobileMenu(false)} className="py-1.5">
                Research
              </a>
              <a href="#contact" onClick={() => setMobileMenu(false)} className="py-1.5">
                Contact
              </a>
            </div>
            <div className="pt-2 border-t border-slate-100 flex gap-3">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={onEnterWorkspace}
                  className="flex-1 py-2.5 bg-[#061B14] text-white text-sm font-medium rounded-lg cursor-pointer"
                >
                  Open Workspace
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenu(false);
                      onOpenAuth('login');
                    }}
                    className="flex-1 py-2.5 border border-slate-300 text-sm font-medium rounded-lg cursor-pointer"
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenu(false);
                      onOpenAuth('register');
                    }}
                    className="flex-1 py-2.5 bg-[#061B14] text-white text-sm font-medium rounded-lg cursor-pointer"
                  >
                    Register
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section id="home" className="bg-[#061B14] text-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <p className="text-xs font-mono tracking-wide text-teal-300">
                Problem Statement ID 25042 · Environmental Genomics
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-[1.12] text-white">
                Identifying Taxonomy and Assessing Biodiversity from eDNA Datasets
              </h1>
              <p className="text-base sm:text-lg text-emerald-100/85 leading-relaxed max-w-xl">
                EcoDNA processes raw FASTA, FASTQ, and ASV CSV sequences through deterministic quality control,
                taxonomic reference alignment, and ecological diversity indexing—paired with grounded scientific
                interpretation.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => (isAuthenticated ? onEnterWorkspace() : onOpenAuth('register'))}
                  className="px-6 py-3 bg-emerald-500 text-[#061B14] font-semibold text-sm rounded-lg hover:bg-emerald-400 transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <span>{isAuthenticated ? 'Go to Dashboard' : 'Start Research Workspace'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a
                  href="#how-it-works"
                  className="px-5 py-3 border border-emerald-700 text-emerald-100 text-sm font-medium rounded-lg hover:bg-emerald-900/50 transition-colors whitespace-nowrap"
                >
                  Explore Pipeline
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] lg:min-h-[400px] rounded-xl overflow-hidden border border-emerald-800/80 bg-[#0D2B21]">
                <img
                  src="/src/assets/images/hero_edna_ecosystem_1795610014534.jpg"
                  alt="Forest watershed and coastal kelp ecosystem showing aquatic eDNA habitat sampling interface"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Full-width Quantitative Platform Strip below hero split */}
          <div className="mt-12 pt-8 border-t border-emerald-900/80 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-mono text-teal-300">Sequence Formats</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">FASTA · FASTQ · CSV</p>
            </div>
            <div>
              <p className="text-xs font-mono text-teal-300">Taxonomic Resolution</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">7 Linnaean Ranks</p>
            </div>
            <div>
              <p className="text-xs font-mono text-teal-300">Biodiversity Indices</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">Shannon H′ · Simpson 1−D</p>
            </div>
            <div>
              <p className="text-xs font-mono text-teal-300">Reference Standards</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">NCBI GenBank · BOLD</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 lg:py-24 bg-[#F7FAF9] border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-5">
            <div className="h-full min-h-[280px] rounded-xl overflow-hidden border border-slate-200 bg-emerald-950">
              <img
                src="/src/assets/images/edna_sampling_field_1795610015938.jpg"
                alt="Field biologist filtering forest stream water for environmental DNA collection"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
            <p className="text-xs font-mono text-emerald-700">About Environmental DNA</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#061B14]">
              Non-invasive biodiversity monitoring from trace genetic material
            </h2>
            <p className="text-base text-slate-600 leading-relaxed">
              Every organism sheds intracellular and extracellular DNA into water, soil, and sediment through skin
              cells, gametes, mucus, and metabolic waste. High-throughput metabarcoding of markers such as COI, 12S
              rRNA, 16S rRNA, 18S rRNA, ITS2, and rbcL enables ecologists to survey entire communities without
              disturbing fragile habitats.
            </p>
            <p className="text-base text-slate-600 leading-relaxed">
              EcoDNA enforces strict empirical safeguards: every sequence is validated for nucleotide integrity and
              Phred quality before reference comparison, and uncertain alignments are assigned conservatively at higher
              taxonomic ranks or marked Unassigned rather than fabricating species calls.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-white border border-slate-200 rounded-lg">
                <p className="text-sm font-semibold text-[#061B14]">Conservative Confidence Tiers</p>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Species assignment requires &ge;97.0% sequence identity; 92–96.9% resolves to Genus; 85–91.9% to Family.
                </p>
              </div>
              <div className="p-4 bg-white border border-slate-200 rounded-lg">
                <p className="text-sm font-semibold text-[#061B14]">Transparent Mode Disclosure</p>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Clearly indicates whether alignments ran against live NCBI/BOLD servers or local curated Demo Mode.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 lg:py-24 bg-white border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-mono text-emerald-700">Platform Capabilities</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#061B14]">
              End-to-end bioinformatics, ecological indexing, and audit-ready reporting
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="p-5 bg-[#F7FAF9] border border-slate-200 rounded-xl space-y-2.5">
                <Dna className="h-5 w-5 text-emerald-700" />
                <h3 className="font-display text-base font-semibold text-[#061B14]">
                  Multi-Format Sequence Validation
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Parses FASTA, FASTQ (with Phred+33 quality scoring), and ASV CSV tables with IUPAC validation and GC%
                  profiling.
                </p>
              </div>

              <div className="p-5 bg-[#F7FAF9] border border-slate-200 rounded-xl space-y-2.5">
                <Microscope className="h-5 w-5 text-emerald-700" />
                <h3 className="font-display text-base font-semibold text-[#061B14]">
                  7-Rank Taxonomic Assignment
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Resolves Kingdom through Species with accession tracking, match percentage, and explicit uncertainty
                  notes.
                </p>
              </div>

              <div className="p-5 bg-[#F7FAF9] border border-slate-200 rounded-xl space-y-2.5">
                <BarChart3 className="h-5 w-5 text-emerald-700" />
                <h3 className="font-display text-base font-semibold text-[#061B14]">
                  Quantitative Diversity Analytics
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Computes Species Richness, Shannon (H&prime;), Simpson (1&minus;D), and Pielou evenness (J&prime;)
                  with interactive Recharts visualizations.
                </p>
              </div>

              <div className="p-5 bg-[#F7FAF9] border border-slate-200 rounded-xl space-y-2.5">
                <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
                <h3 className="font-display text-base font-semibold text-[#061B14]">
                  Publication-Grade PDF &amp; CSV Exports
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Generates complete reports with researcher info, sample metadata, distribution charts, methodology,
                  and limitations.
                </p>
              </div>

              <div className="p-5 bg-[#F7FAF9] border border-slate-200 rounded-xl space-y-2.5 sm:col-span-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="h-5 w-5 text-emerald-700" />
                    <h3 className="font-display text-base font-semibold text-[#061B14]">
                      Private Storage &amp; Grounded Gemini Interpretation
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Raw sequence files and reports stay isolated in private storage keyed by verified Firebase UID. The
                  Gemini Research Assistant interprets verified numerical results without ever replacing sequence
                  alignment.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="h-full min-h-[300px] rounded-xl overflow-hidden border border-slate-200 bg-[#061B14]">
                <img
                  src="/src/assets/images/edna_lab_sequencing_1795610017021.jpg"
                  alt="High-precision microfluidic DNA sequencing instrument with optical flow cell"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 lg:py-24 bg-[#F7FAF9] border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-mono text-emerald-700">How It Works</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#061B14]">
              Four deterministic steps from raw reads to ecological insight
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01. Upload & Metadata',
                desc: 'Submit FASTA, FASTQ, or CSV eDNA files alongside sample location, type, collection date, and habitat notes.',
              },
              {
                step: '02. Validation & QC',
                desc: 'Automated parser verifies IUPAC nucleotides, sequence length (>=30 bp), GC%, and Phred+33 quality scores.',
              },
              {
                step: '03. Taxonomic Alignment',
                desc: 'K-mer containment and base-identity alignment matches sequences against reference barcodes with strict confidence thresholds.',
              },
              {
                step: '04. Metrics & Reports',
                desc: 'Compute Shannon/Simpson indices, explore Recharts visuals, query Gemini on verified outputs, and export PDF/CSV.',
              },
            ].map((item) => (
              <div key={item.step} className="p-6 bg-white border border-slate-200 rounded-xl space-y-3">
                <h3 className="font-display text-base font-semibold text-[#061B14]">{item.step}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Research & Project Information Section */}
      <section id="research" className="py-16 lg:py-24 bg-white border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
            <p className="text-xs font-mono text-emerald-700">Project Specification · Problem Statement ID 25042</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#061B14]">
              Built for reproducible freshwater, marine, and soil eDNA studies
            </h2>
            <p className="text-base text-slate-600 leading-relaxed">
              Designed for environmental agencies, university biodiversity labs, and conservation teams addressing
              Problem Statement 25042: Identifying Taxonomy and Assessing Biodiversity from eDNA Datasets.
            </p>
            <ul className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-2.5">
                <Database className="h-4 w-4 text-emerald-700 mt-0.5 shrink-0" />
                <span>
                  Supports COI, 12S rRNA, 16S rRNA, 18S rRNA, ITS2, and rbcL amplicon barcode markers.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 mt-0.5 shrink-0" />
                <span>
                  Enforces strict researcher data isolation via Firebase ID token verification and row ownership policies.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-700 mt-0.5 shrink-0" />
                <span>
                  Preserves full uncertainty provenance in every taxonomy table row and exported PDF/CSV report.
                </span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[280px] rounded-xl overflow-hidden border border-slate-200 bg-[#061B14]">
              <img
                src="/src/assets/images/edna_taxonomy_atlas_1795610016750.jpg"
                alt="Curated microscope specimen slides of diatoms, fern spores, coral polyps, and freshwater insects"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 lg:py-20 bg-[#F7FAF9]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-4">
            <p className="text-xs font-mono text-emerald-700">Research Collaboration</p>
            <h2 className="font-display text-3xl font-bold text-[#061B14]">Contact the EcoDNA Team</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Questions regarding custom reference database integration, institutional deployment, or Problem Statement
              25042 datasets? Send an inquiry below.
            </p>
            <div className="pt-2 space-y-1 text-sm text-slate-700">
              <p>
                <strong>Project Track:</strong> Biodiversity &amp; Environmental Genomics
              </p>
              <p>
                <strong>Problem Statement ID:</strong> 25042
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
            {contactSent ? (
              <div className="space-y-3 py-6">
                <h3 className="font-display text-lg font-semibold text-[#061B14]">Inquiry Recorded</h3>
                <p className="text-sm text-slate-600">
                  Thank you for reaching out. Our research engineering team will respond to your email shortly.
                </p>
                <button
                  type="button"
                  onClick={() => setContactSent(false)}
                  className="px-4 py-2 text-sm font-medium bg-[#061B14] text-white rounded-lg cursor-pointer"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                {contactError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                    {contactError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      placeholder="Dr. Ananya Rao"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      placeholder="researcher@institute.edu"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Institution / Lab (Optional)</label>
                  <input
                    type="text"
                    value={contactForm.organization}
                    onChange={(e) => setContactForm((f) => ({ ...f, organization: e.target.value }))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    placeholder="National Marine Biodiversity Lab"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Message</label>
                  <textarea
                    rows={4}
                    required
                    value={contactForm.message}
                    onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    placeholder="Describe your eDNA sampling project or dataset requirements..."
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#061B14] text-white text-sm font-medium rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer"
                >
                  Submit Inquiry
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Quiet Footer (No hidden/public admin link) */}
      <footer className="bg-[#061B14] text-emerald-100/80 border-t border-emerald-950">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <EcoDnaLogo variant="light" size="sm" />
            <p className="text-xs text-emerald-200/70">
              EcoDNA – Biodiversity Intelligence Platform · Problem Statement ID: 25042
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs">
            <a href="#about" className="hover:text-white transition-colors">
              About
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#research" className="hover:text-white transition-colors">
              Research
            </a>
            <a href="#contact" className="hover:text-white transition-colors">
              Contact
            </a>
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Researcher Login
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
