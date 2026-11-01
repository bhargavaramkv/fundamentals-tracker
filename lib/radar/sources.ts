import type { SourceDef } from "./types";

/**
 * Where the radar looks. Official vendor/project feeds are credibility 3; established publications and research
 * venues 2. Publications that span topics are listed in MIXED_SOURCES, so each story is classified by its own text.
 * Add or remove sources here; the pipeline needs no other change.
 */
export const SOURCES: SourceDef[] = [
  // AI & Machine Learning
  { id: "openai", name: "OpenAI News", kind: "feed", url: "https://openai.com/news/rss.xml", homepage: "https://openai.com/news/", category: "ai-ml", credibility: 3, maxItems: 6 },
  { id: "google-ai", name: "Google AI Blog", kind: "feed", url: "https://blog.google/technology/ai/rss/", homepage: "https://blog.google/technology/ai/", category: "ai-ml", credibility: 3, maxItems: 6 },
  { id: "deepmind", name: "Google DeepMind", kind: "feed", url: "https://deepmind.google/blog/rss.xml", homepage: "https://deepmind.google/discover/blog/", category: "ai-ml", credibility: 3, maxItems: 5 },
  { id: "huggingface", name: "Hugging Face Blog", kind: "feed", url: "https://huggingface.co/blog/feed.xml", homepage: "https://huggingface.co/blog", category: "ai-ml", credibility: 3, maxItems: 5 },
  { id: "nvidia-dev", name: "NVIDIA Technical Blog", kind: "feed", url: "https://developer.nvidia.com/blog/feed", homepage: "https://developer.nvidia.com/blog/", category: "ai-ml", credibility: 3, maxItems: 4 },

  // Developer Ecosystem
  { id: "github-blog", name: "The GitHub Blog", kind: "feed", url: "https://github.blog/feed/", homepage: "https://github.blog/", category: "developer-tools", credibility: 3, maxItems: 6 },
  { id: "typescript-blog", name: "TypeScript Blog", kind: "feed", url: "https://devblogs.microsoft.com/typescript/feed/", homepage: "https://devblogs.microsoft.com/typescript/", category: "programming", credibility: 3, maxItems: 3 },
  { id: "dotnet-blog", name: ".NET Blog", kind: "feed", url: "https://devblogs.microsoft.com/dotnet/feed/", homepage: "https://devblogs.microsoft.com/dotnet/", category: "programming", credibility: 3, maxItems: 4 },
  { id: "rust-blog", name: "Rust Blog", kind: "feed", url: "https://blog.rust-lang.org/feed.xml", homepage: "https://blog.rust-lang.org/", category: "programming", credibility: 3, maxItems: 3 },
  { id: "go-blog", name: "The Go Blog", kind: "feed", url: "https://go.dev/blog/feed.atom", homepage: "https://go.dev/blog/", category: "programming", credibility: 3, maxItems: 3 },
  { id: "python-insider", name: "Python Insider", kind: "feed", url: "https://blog.python.org/feeds/posts/default", homepage: "https://blog.python.org/", category: "programming", credibility: 3, maxItems: 3 },
  { id: "nodejs-blog", name: "Node.js Blog", kind: "feed", url: "https://nodejs.org/en/feed/blog.xml", homepage: "https://nodejs.org/en/blog", category: "programming", credibility: 3, maxItems: 4 },
  { id: "react-blog", name: "React Blog", kind: "feed", url: "https://react.dev/rss.xml", homepage: "https://react.dev/blog", category: "programming", credibility: 3, maxItems: 3 },
  { id: "angular-blog", name: "Angular Blog", kind: "feed", url: "https://blog.angular.dev/feed", homepage: "https://blog.angular.dev/", category: "programming", credibility: 3, maxItems: 3 },
  { id: "gh-typescript", name: "TypeScript releases", kind: "github-releases", url: "microsoft/TypeScript", homepage: "https://github.com/microsoft/TypeScript/releases", category: "programming", credibility: 3, maxItems: 2 },
  { id: "gh-kubernetes", name: "Kubernetes releases", kind: "github-releases", url: "kubernetes/kubernetes", homepage: "https://github.com/kubernetes/kubernetes/releases", category: "infrastructure", credibility: 3, maxItems: 2 },
  { id: "gh-angular", name: "Angular releases", kind: "github-releases", url: "angular/angular", homepage: "https://github.com/angular/angular/releases", category: "programming", credibility: 3, maxItems: 2 },
  { id: "infoq", name: "InfoQ", kind: "feed", url: "https://feed.infoq.com/", homepage: "https://www.infoq.com/", category: "programming", credibility: 2, maxItems: 6 },

  // Cloud & Infrastructure (including databases and distributed systems)
  { id: "aws-news", name: "AWS News Blog", kind: "feed", url: "https://aws.amazon.com/blogs/aws/feed/", homepage: "https://aws.amazon.com/blogs/aws/", category: "cloud", credibility: 3, maxItems: 5 },
  { id: "gcp-blog", name: "Google Cloud Blog", kind: "feed", url: "https://cloudblog.withgoogle.com/rss/", homepage: "https://cloud.google.com/blog", category: "cloud", credibility: 3, maxItems: 5 },
  { id: "azure-blog", name: "Microsoft Azure Blog", kind: "feed", url: "https://azure.microsoft.com/en-us/blog/feed/", homepage: "https://azure.microsoft.com/en-us/blog/", category: "cloud", credibility: 3, maxItems: 5 },
  { id: "cloudflare", name: "Cloudflare Blog", kind: "feed", url: "https://blog.cloudflare.com/rss/", homepage: "https://blog.cloudflare.com/", category: "cloud", credibility: 3, maxItems: 5 },
  { id: "kubernetes-blog", name: "Kubernetes Blog", kind: "feed", url: "https://kubernetes.io/feed.xml", homepage: "https://kubernetes.io/blog/", category: "infrastructure", credibility: 3, maxItems: 3 },
  { id: "cncf", name: "CNCF Blog", kind: "feed", url: "https://www.cncf.io/feed/", homepage: "https://www.cncf.io/blog/", category: "infrastructure", credibility: 2, maxItems: 4 },
  { id: "postgresql", name: "PostgreSQL News", kind: "feed", url: "https://www.postgresql.org/news.rss", homepage: "https://www.postgresql.org/about/newsarchive/", category: "databases", credibility: 3, maxItems: 3 },
  { id: "mongodb", name: "MongoDB Blog", kind: "feed", url: "https://www.mongodb.com/blog/rss", homepage: "https://www.mongodb.com/blog", category: "databases", credibility: 3, maxItems: 3 },

  // Cybersecurity
  { id: "cisa-kev", name: "CISA Known Exploited Vulnerabilities", kind: "cisa-kev", url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", homepage: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", category: "security", credibility: 3, maxItems: 3 },
  { id: "cisa-advisories", name: "CISA Cybersecurity Advisories", kind: "feed", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml", homepage: "https://www.cisa.gov/news-events/cybersecurity-advisories", category: "security", credibility: 3, maxItems: 2 },
  { id: "ms-security", name: "Microsoft Security Blog", kind: "feed", url: "https://www.microsoft.com/en-us/security/blog/feed/", homepage: "https://www.microsoft.com/en-us/security/blog/", category: "security", credibility: 3, maxItems: 3 },
  { id: "project-zero", name: "Google Project Zero", kind: "feed", url: "https://googleprojectzero.blogspot.com/feeds/posts/default", homepage: "https://googleprojectzero.blogspot.com/", category: "security", credibility: 3, maxItems: 3 },
  { id: "bleepingcomputer", name: "BleepingComputer", kind: "feed", url: "https://www.bleepingcomputer.com/feed/", homepage: "https://www.bleepingcomputer.com/", category: "security", credibility: 2, maxItems: 3 },
  { id: "krebs", name: "Krebs on Security", kind: "feed", url: "https://krebsonsecurity.com/feed/", homepage: "https://krebsonsecurity.com/", category: "security", credibility: 2, maxItems: 3 },

  // Hardware & Emerging Technology
  { id: "nvidia-blog", name: "NVIDIA Blog", kind: "feed", url: "https://blogs.nvidia.com/feed/", homepage: "https://blogs.nvidia.com/", category: "hardware", credibility: 3, maxItems: 4 },
  { id: "ieee-spectrum", name: "IEEE Spectrum", kind: "feed", url: "https://spectrum.ieee.org/feeds/feed.rss", homepage: "https://spectrum.ieee.org/", category: "hardware", credibility: 2, maxItems: 6 },
  { id: "ars-technica", name: "Ars Technica", kind: "feed", url: "https://feeds.arstechnica.com/arstechnica/technology-lab", homepage: "https://arstechnica.com/", category: "hardware", credibility: 2, maxItems: 6 },
  { id: "hacker-news", name: "Hacker News (200+ points)", kind: "feed", url: "https://hnrss.org/frontpage?points=200", homepage: "https://news.ycombinator.com/", category: "programming", credibility: 2, maxItems: 8 },
  { id: "the-verge", name: "The Verge: Tech", kind: "feed", url: "https://www.theverge.com/rss/tech/index.xml", homepage: "https://www.theverge.com/tech", category: "hardware", credibility: 2, maxItems: 5 },
  { id: "mit-tech-review", name: "MIT Technology Review", kind: "feed", url: "https://www.technologyreview.com/feed/", homepage: "https://www.technologyreview.com/", category: "hardware", credibility: 2, maxItems: 5 },

  // Research & Engineering Breakthroughs
  { id: "google-research", name: "Google Research Blog", kind: "feed", url: "https://research.google/blog/rss/", homepage: "https://research.google/blog/", category: "research", credibility: 3, maxItems: 4 },
  { id: "meta-engineering", name: "Engineering at Meta", kind: "feed", url: "https://engineering.fb.com/feed/", homepage: "https://engineering.fb.com/", category: "infrastructure", credibility: 3, maxItems: 3 },
  { id: "netflix-tech", name: "Netflix TechBlog", kind: "feed", url: "https://netflixtechblog.com/feed", homepage: "https://netflixtechblog.com/", category: "infrastructure", credibility: 3, maxItems: 3 },
  { id: "stackoverflow-blog", name: "Stack Overflow Blog", kind: "feed", url: "https://stackoverflow.blog/feed/", homepage: "https://stackoverflow.blog/", category: "programming", credibility: 2, maxItems: 3 },
  { id: "the-new-stack", name: "The New Stack", kind: "feed", url: "https://thenewstack.io/feed/", homepage: "https://thenewstack.io/", category: "infrastructure", credibility: 2, maxItems: 4 },
  { id: "arxiv-dc", name: "arXiv: Distributed Computing", kind: "feed", url: "https://rss.arxiv.org/rss/cs.DC", homepage: "https://arxiv.org/list/cs.DC/new", category: "research", credibility: 2, maxItems: 4 },
  { id: "arxiv-db", name: "arXiv: Databases", kind: "feed", url: "https://rss.arxiv.org/rss/cs.DB", homepage: "https://arxiv.org/list/cs.DB/new", category: "research", credibility: 2, maxItems: 3 },

  // Developer tools
  { id: "vscode", name: "VS Code Updates", kind: "feed", url: "https://code.visualstudio.com/feed.xml", homepage: "https://code.visualstudio.com/updates", category: "developer-tools", credibility: 3, maxItems: 2 },
  { id: "jetbrains", name: "JetBrains Blog", kind: "feed", url: "https://blog.jetbrains.com/feed/", homepage: "https://blog.jetbrains.com/", category: "developer-tools", credibility: 3, maxItems: 3 },
  { id: "gitlab", name: "GitLab Blog", kind: "feed", url: "https://about.gitlab.com/atom.xml", homepage: "https://about.gitlab.com/blog/", category: "developer-tools", credibility: 3, maxItems: 3 },
  { id: "github-changelog", name: "GitHub Changelog", kind: "feed", url: "https://github.blog/changelog/feed/", homepage: "https://github.blog/changelog/", category: "developer-tools", credibility: 3, maxItems: 3 },
  { id: "visual-studio", name: "Visual Studio Blog", kind: "feed", url: "https://devblogs.microsoft.com/visualstudio/feed/", homepage: "https://devblogs.microsoft.com/visualstudio/", category: "developer-tools", credibility: 3, maxItems: 2 },

  // Programming languages
  { id: "inside-java", name: "Inside Java", kind: "feed", url: "https://inside.java/feed.xml", homepage: "https://inside.java/", category: "programming", credibility: 3, maxItems: 3 },
  { id: "kotlin-blog", name: "Kotlin Blog", kind: "feed", url: "https://blog.jetbrains.com/kotlin/feed/", homepage: "https://blog.jetbrains.com/kotlin/", category: "programming", credibility: 3, maxItems: 2 },

  // Databases
  { id: "redis-blog", name: "Redis Blog", kind: "feed", url: "https://redis.io/blog/feed/", homepage: "https://redis.io/blog/", category: "databases", credibility: 3, maxItems: 3 },
  { id: "duckdb", name: "DuckDB Blog", kind: "feed", url: "https://duckdb.org/feed.xml", homepage: "https://duckdb.org/news/", category: "databases", credibility: 3, maxItems: 2 },
  { id: "clickhouse", name: "ClickHouse Blog", kind: "feed", url: "https://clickhouse.com/rss.xml", homepage: "https://clickhouse.com/blog", category: "databases", credibility: 3, maxItems: 2 },
  { id: "planet-postgres", name: "Planet PostgreSQL", kind: "feed", url: "https://planet.postgresql.org/rss20.xml", homepage: "https://planet.postgresql.org/", category: "databases", credibility: 2, maxItems: 3 },

  // Infrastructure and cloud architecture
  { id: "docker-blog", name: "Docker Blog", kind: "feed", url: "https://www.docker.com/blog/feed/", homepage: "https://www.docker.com/blog/", category: "infrastructure", credibility: 3, maxItems: 3 },
  { id: "grafana-blog", name: "Grafana Labs Blog", kind: "feed", url: "https://grafana.com/blog/index.xml", homepage: "https://grafana.com/blog/", category: "infrastructure", credibility: 3, maxItems: 2 },
  { id: "aws-architecture", name: "AWS Architecture Blog", kind: "feed", url: "https://aws.amazon.com/blogs/architecture/feed/", homepage: "https://aws.amazon.com/blogs/architecture/", category: "cloud", credibility: 3, maxItems: 3 },

  // Open source
  { id: "lwn", name: "LWN.net", kind: "feed", url: "https://lwn.net/headlines/rss", homepage: "https://lwn.net/", category: "open-source", credibility: 2, maxItems: 4 },
  { id: "linux-foundation", name: "Linux Foundation Blog", kind: "feed", url: "https://www.linuxfoundation.org/blog/rss.xml", homepage: "https://www.linuxfoundation.org/blog", category: "open-source", credibility: 3, maxItems: 3 },
  { id: "ms-opensource", name: "Microsoft Open Source Blog", kind: "feed", url: "https://opensource.microsoft.com/blog/feed/", homepage: "https://opensource.microsoft.com/blog/", category: "open-source", credibility: 3, maxItems: 3 },
  { id: "apache", name: "Apache Software Foundation News", kind: "feed", url: "https://news.apache.org/feed", homepage: "https://news.apache.org/", category: "open-source", credibility: 3, maxItems: 3 },
];

/** Publications whose stories span categories: each story is classified by its own text instead of the source default. */
export const MIXED_SOURCES = new Set(["infoq", "bleepingcomputer", "ars-technica", "hacker-news", "the-verge", "mit-tech-review", "ieee-spectrum", "the-new-stack", "stackoverflow-blog", "lwn", "meta-engineering", "netflix-tech"]);

export const sourceById = (id: string): SourceDef | undefined => SOURCES.find((s) => s.id === id);
