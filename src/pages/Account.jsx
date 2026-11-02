import { useCurrentUser } from '../data/currentUser';

export default function Account() {
  const user = useCurrentUser();

  return (
    <main className="page">
      <h1>My Account</h1>
      <dl className="account-details">
        <dt>Name</dt>
        <dd>{user.name}</dd>
        <dt>UW email</dt>
        <dd>{user.uwEmail}</dd>
      </dl>
    </main>
  );
}
