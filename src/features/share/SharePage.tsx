import { Link, useSearchParams } from 'react-router-dom';
import { formatNote } from './formatNote';
import './share.css';

export function SharePage() {
  const [searchParams] = useSearchParams();
  const note = searchParams.get('note');

  return (
    <main className="auth-page">
      <section className="card">
        <h1>Carrot Cart</h1>
        {note && (
          <div className="share-note">
            <p className="share-note-label">Note from your contact</p>
            <div className="share-note-body" dangerouslySetInnerHTML={{ __html: formatNote(note) }} />
          </div>
        )}
        <p className="muted">
          Someone shared this with you. <Link to="/sign-in">Sign in</Link> to see pricing and place an
          order.
        </p>
      </section>
    </main>
  );
}
