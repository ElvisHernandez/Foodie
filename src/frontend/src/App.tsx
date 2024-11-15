
function App() {

  //useEffect(() => {
  //  (async () => {
  //    const res = await fetch('http://localhost:4000/auth/google/url')
  //      .then(r => r.json())
  //      .catch((err) => console.log(err));
  //
  //    //console.log({ res });
  //
  //    if (res.redirectUrl) {
  //    }
  //  })();
  //}, []);

  return (
    <div>
      <h1>OAuth practice</h1>

      <a href="http://localhost:4000/auth/google/url">Sign in with Google</a>
    </div>
  )
}

export default App
