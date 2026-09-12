import Link from 'next/link';
import '../(app)/app.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="nav">
        <Link className="wordmark" href="/">
          <span className="wordmark-bar" aria-hidden="true" />
          Redline
        </Link>
      </header>
      <main className="gate">{children}</main>
    </>
  );
}
