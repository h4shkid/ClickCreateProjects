import { Metadata } from 'next'
import { Mail, MessageCircle, Twitter, Send } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contact Us - ClickCreate',
  description: 'Get in touch with the ClickCreate team',
}

const contactMethods = [
  {
    icon: MessageCircle,
    title: 'Discord Community',
    description: 'Join our Discord server for real-time support and community discussions',
    action: 'Join Discord',
    href: '#',
    primary: true,
  },
  {
    icon: Twitter,
    title: 'Twitter',
    description: 'Follow us for updates, tips, and announcements',
    action: '@ClickCreate',
    href: '#',
    primary: false,
  },
  {
    icon: Mail,
    title: 'Email',
    description: 'For business inquiries and partnership opportunities',
    action: 'hello@clickcreate.xyz',
    href: 'mailto:hello@clickcreate.xyz',
    primary: false,
  },
]

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative mx-auto px-6 py-16 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Get in{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Touch
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Have questions, feedback, or just want to say hello? We'd love to hear from you.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-16 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Contact Form */}
          <div>
            <div className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">Send us a Message</h2>
              <p className="text-muted-foreground">
                Fill out the form below and we'll get back to you as soon as possible.
              </p>
            </div>

            <form className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-medium">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="mb-2 block text-sm font-medium">
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  placeholder="What's this about?"
                />
              </div>

              <div>
                <label htmlFor="category" className="mb-2 block text-sm font-medium">
                  Category
                </label>
                <select
                  id="category"
                  className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option>General Inquiry</option>
                  <option>Technical Support</option>
                  <option>Feature Request</option>
                  <option>Bug Report</option>
                  <option>Partnership</option>
                  <option>Media Inquiry</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="mb-2 block text-sm font-medium">
                  Message
                </label>
                <textarea
                  id="message"
                  rows={6}
                  className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  placeholder="Tell us more..."
                />
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
                Send Message
              </button>

              <p className="text-xs text-muted-foreground">
                By submitting this form, you agree to our{' '}
                <a href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </a>
                .
              </p>
            </form>
          </div>

          {/* Contact Methods */}
          <div>
            <div className="mb-8">
              <h2 className="mb-4 text-2xl font-bold">Other Ways to Reach Us</h2>
              <p className="text-muted-foreground">
                Choose the channel that works best for you.
              </p>
            </div>

            <div className="space-y-4">
              {contactMethods.map((method) => {
                const Icon = method.icon
                return (
                  <a
                    key={method.title}
                    href={method.href}
                    className={`group block rounded-lg border transition-all ${
                      method.primary
                        ? 'border-primary/50 bg-gradient-to-br from-primary/10 to-accent/10 hover:border-primary'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${
                          method.primary ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
                        }`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="mb-1 font-semibold group-hover:text-primary transition-colors">
                            {method.title}
                          </h3>
                          <p className="mb-3 text-sm text-muted-foreground">
                            {method.description}
                          </p>
                          <div className="flex items-center text-sm text-primary">
                            {method.action}
                            <span className="ml-2 transition-transform group-hover:translate-x-1">
                              →
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>

            {/* FAQ Link */}
            <div className="mt-8 rounded-lg border border-border bg-card p-6">
              <h3 className="mb-2 font-semibold">Looking for Help?</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Check out our documentation and tutorials for answers to common questions.
              </p>
              <div className="flex gap-3">
                <a
                  href="/docs"
                  className="text-sm text-primary hover:underline"
                >
                  Documentation
                </a>
                <span className="text-muted-foreground">•</span>
                <a
                  href="/tutorials"
                  className="text-sm text-primary hover:underline"
                >
                  Tutorials
                </a>
                <span className="text-muted-foreground">•</span>
                <a
                  href="/api-reference"
                  className="text-sm text-primary hover:underline"
                >
                  API Reference
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Business Inquiries */}
        <div className="mt-16 rounded-lg border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-8 text-center max-w-3xl mx-auto">
          <h2 className="mb-4 text-2xl font-bold">Business & Partnership Inquiries</h2>
          <p className="mb-6 text-muted-foreground">
            Interested in partnering with ClickCreate or integrating our analytics into your platform? We'd love to explore opportunities together.
          </p>
          <a
            href="mailto:partnerships@clickcreate.xyz"
            className="inline-flex items-center justify-center rounded-md border border-primary bg-background px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            partnerships@clickcreate.xyz
          </a>
        </div>
      </div>
    </div>
  )
}
