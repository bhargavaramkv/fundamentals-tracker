import type { SourceDef } from "./types";

/**
 * Where the radar looks. Official vendor/project feeds are credibility 3; established publications and research
 * venues 2. Broad publications set `mixed: true`-style routing through `classifyCategory` (see classify.ts) because
 * their stories span categories. Add or remove sources here; the pipeline needs no other change.
 */
export const SOURCES: SourceDef[] = [
  // AI & Machine Learning
  { id: "openai", name: "OpenAI News", kind: "feed", url: "https://openai.com/news/rss.xml", homepage: "https://openai.com/news/", category: "ai-ml", credibility: 3, maxItems: 6 },
  { id: "google-ai", name: "Google AI Blog", kind: "feed", url: "https://blog.google/technology/ai/rss/", homepage: "https://blog.google/technology/ai/", category: "ai-ml", credibility: 3, maxItems: 6 },
  { id: "deepmind", name: "Google DeepMind", kind: "feed", url: "https://deepmind.google/blog/rss.xml", homepage: "https://deepmind.google/discover/blog/", category: "ai-ml", credibility: 3, maxItems: 5 },
  { id: "huggingface", name: "Hugging Face Blog", kind: "feed", url: "https://huggingface.co/blog/feed.xml", homepage: "https://huggingface.co/blog", category: "ai-ml", credibility: 3, maxItems: 5 },
  { id: "nvidia-dev", name: "NVIDIA Technical Blog", kind: "feed", url: "https://developer.nvidia.com/blog/feed", homepage: "https://developer.nvidia.com/blog/", category: "ai-ml", credibility: 3, maxItems: 4 },

  // Developer Ecosystem
  { id: "github-blog", name: "The GitHub Blog", kind: "feed", url: "https://github.blog/feed/", homepage: "https://github.blog/", category: "developer", credibility: 3, maxItems: 6 },
  { id: "typescript-blog", name: "TypeScript Blog", kind: "feed", url: "https://devblogs.microsoft.com/typescript/feed/", homepage: "https://devblogs.microsoft.com/typescript/", category: "developer", credibility: 3, maxItems: 3 },
  { id: "dotnet-blog", name: ".NET Blog", kind: "feed", url: "https://devblogs.microsoft.com/dotnet/feed/", homepage: "https://devblogs.microsoft.com/dotnet/", category: "developer", credibility: 3, maxItems: 4 },
  { id: "rust-blog", name: "Rust Blog", kind: "feed", url: "https://blog.rust-lang.org/feed.xml", homepage: "https://blog.rust-lang.org/", category: "developer", credibility: 3, maxItems: 3 },
  { id: "go-blog", name: "The Go Blog", kind: "feed", url: "https://go.dev/blog/feed.atom", homepage: "https://go.dev/blog/", category: "developer", credibility: 3, maxItems: 3 },
  { id: "python-insider", name: "Python Insider", kind: "feed", url: "https://blog.python.org/feeds/posts/default", homepage: "https://blog.python.org/", category: "developer", credibility: 3, maxItems: 3 },
  { id: "nodejs-blog", name: "Node.js Blog", kind: "feed", url: "https://nodejs.org/en/feed/blog.xml", homepage: "https://nodejs.org/en/blog", category: "developer", credibility: 3, maxItems: 4 },
  { id: "react-blog", name: "React Blog", kind: "feed", url: "https://react.dev/rss.xml", homepage: "https://react.dev/blog", category: "developer", credibility: 3, maxItems: 3 },
  { id: "angular-blog", name: "Angular Blog", kind: "feed", url: "https://blog.angular.dev/feed", homepage: "https://blog.angular.dev/", category: "developer", credibility: 3, maxItems: 3 },
  { id: "gh-typescript", name: "TypeScript releases", kind: "github-releases", url: "microsoft/TypeScript", homepage: "https://github.com/microsoft/TypeScript/releases", category: "developer", credibility: 3, maxItems: 2 },
  { id: "gh-kubernetes", name: "Kubernetes releases", kind: "github-releases", url: "kubernetes/kubernetes", homepage: "https://github.com/kubernetes/kubernetes/releases", category: "cloud", credibility: 3, maxItems: 2 },
  { id: "gh-angular", name: "Angular releases", kind: "github-releases", url: "angular/angular", homepage: "https://github.com/angular/angular/releases", category: "developer", credibility: 3, maxItems: 2 },
  { id: "infoq", name: "InfoQ", kind: "feed", url: "https://feed.infoq.com/", homepage: "https://www.infoq.com/", category: "developer", credibility: 2, maxItems: 6 },

  // Cloud & Infrastructure (including databases and distributed systems)
  { id: "aws-news", name: "AWS News Blog", kind: "feed", url: "https://aws.amazon.com/blogs/aws/feed/", homepage: "https://aws.amazon.com/blogs/aws/", category: "cloud", credibility: 3, maxItems: 5 },
  { id: "gcp-blog", name: "Google Cloud Blog", kind: "feed", url: "https://cloudblog.withgoogle.com/rss/", homepage: "https://cloud.google.com/blog", category: "cloud", credibility: 3, maxItems: 5 },
  { id: "azure-blog", name: "Microsoft Azure Blog", kind: "feed", url: "https://azure.microsoft.com/en-us/blog/feed/", homepage: "https://azure.microsoft.com/en-us/blog/", category: "cloud", credibility: 3, maxItems: 5 },
  { id: "cloudflare", name: "Cloudflare Blog", kind: "feed", url: "https://blog.cloudflare.com/rss/", homepage: "https://blog.cloudflare.com/", category: "cloud", credibility: 3, maxItems: 5 },
  { id: "kubernetes-blog", name: "Kubernetes Blog", kind: "feed", url: "https://kubernetes.io/feed.xml", homepage: "https://kubernetes.io/blog/", category: "cloud", credibility: 3, maxItems: 3 },
  { id: "cncf", name: "CNCF Blog", kind: "feed", url: "https://www.cncf.io/feed/", homepage: "https://www.cncf.io/blog/", category: "cloud", credibility: 2, maxItems: 4 },
  { id: "postgresql", name: "PostgreSQL News", kind: "feed", url: "https://www.postgresql.org/news.rss", homepage: "https://www.postgresql.org/about/newsarchive/", category: "cloud", credibility: 3, maxItems: 3 },
  { id: "mongodb", name: "MongoDB Blog", kind: "feed", url: "https://www.mongodb.com/blog/rss", homepage: "https://www.mongodb.com/blog", category: "cloud", credibility: 3, maxItems: 3 },

  // Cybersecurity
  { id: "cisa-kev", name: "CISA Known Exploited Vulnerabilities", kind: "cisa-kev", url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", homepage: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", category: "security", credibility: 3, maxItems: 8 },
  { id: "cisa-advisories", name: "CISA Cybersecurity Advisories", kind: "feed", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml", homepage: "https://www.cisa.gov/news-events/cybersecurity-advisories", category: "security", credibility: 3, maxItems: 5 },
  { id: "msrc", name: "Microsoft Security Response Center", kind: "feed", url: "https://msrc.microsoft.com/blog/feed", homepage: "https://msrc.microsoft.com/blog/", category: "security", credibility: 3, maxItems: 3 },
  { id: "project-zero", name: "Google Project Zero", kind: "feed", url: "https://googleprojectzero.blogspot.com/feeds/posts/default", homepage: "https://googleprojectzero.blogspot.com/", category: "security", credibility: 3, maxItems: 3 },
  { id: "bleepingcomputer", name: "BleepingComputer", kind: "feed", url: "https://www.bleepingcomputer.com/feed/", homepage: "https://www.bleepingcomputer.com/", category: "security", credibility: 2, maxItems: 8 },
  { id: "krebs", name: "Krebs on Security", kind: "feed", url: "https://krebsonsecurity.com/feed/", homepage: "https://krebsonsecurity.com/", category: "security", credibility: 2, maxItems: 3 },

  // Hardware & Emerging Technology
  { id: "nvidia-blog", name: "NVIDIA Blog", kind: "feed", url: "https://blogs.nvidia.com/feed/", homepage: "https://blogs.nvidia.com/", category: "hardware", credibility: 3, maxItems: 4 },
  { id: "ieee-spectrum", name: "IEEE Spectrum", kind: "feed", url: "https://spectrum.ieee.org/feeds/feed.rss", homepage: "https://spectrum.ieee.org/", category: "hardware", credibility: 2, maxItems: 6 },
  { id: "ars-technica", name: "Ars Technica", kind: "feed", url: "https://feeds.arstechnica.com/arstechnica/technology-lab", homepage: "https://arstechnica.com/", category: "hardware", credibility: 2, maxItems: 6 },
  { id: "the-register", name: "The Register", kind: "feed", url: "https://www.theregister.com/headlines.atom", homepage: "https://www.theregister.com/", category: "hardware", credibility: 2, maxItems: 8 },
  { id: "mit-tech-review", name: "MIT Technology Review", kind: "feed", url: "https://www.technologyreview.com/feed/", homepage: "https://www.technologyreview.com/", category: "hardware", credibility: 2, maxItems: 5 },

  // Research & Engineering Breakthroughs
  { id: "google-research", name: "Google Research Blog", kind: "feed", url: "https://research.google/blog/rss/", homepage: "https://research.google/blog/", category: "research", credibility: 3, maxItems: 4 },
  { id: "meta-engineering", name: "Engineering at Meta", kind: "feed", url: "https://engineering.fb.com/feed/", homepage: "https://engineering.fb.com/", category: "research", credibility: 3, maxItems: 3 },
  { id: "netflix-tech", name: "Netflix TechBlog", kind: "feed", url: "https://netflixtechblog.com/feed", homepage: "https://netflixtechblog.com/", category: "research", credibility: 3, maxItems: 3 },
  { id: "acm-queue", name: "ACM Queue", kind: "feed", url: "https://queue.acm.org/rss/feeds/queuecontent.xml", homepage: "https://queue.acm.org/", category: "research", credibility: 2, maxItems: 3 },
  { id: "arxiv-dc", name: "arXiv: Distributed Computing", kind: "feed", url: "https://rss.arxiv.org/rss/cs.DC", homepage: "https://arxiv.org/list/cs.DC/new", category: "research", credibility: 2, maxItems: 4 },
  { id: "arxiv-db", name: "arXiv: Databases", kind: "feed", url: "https://rss.arxiv.org/rss/cs.DB", homepage: "https://arxiv.org/list/cs.DB/new", category: "research", credibility: 2, maxItems: 3 },
];

/** Publications whose stories span categories: each story is classified by its own text instead of the source default. */
export const MIXED_SOURCES = new Set(["infoq", "bleepingcomputer", "ars-technica", "the-register", "mit-tech-review", "ieee-spectrum"]);

export const sourceById = (id: string): SourceDef | undefined => SOURCES.find((s) => s.id === id);
