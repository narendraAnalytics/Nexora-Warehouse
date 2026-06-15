import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(128deg, #FF7840 0%, #E03898 30%, #8B2EE0 62%, #12C0D0 100%)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <SignUp />
    </div>
  );
}
