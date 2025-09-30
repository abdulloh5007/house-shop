export function Footer() {
  return (
    <footer className="border-t">
      <div className="container flex flex-col items-center justify-center gap-4 h-24 md:flex-row">
        <p className="text-sm leading-loose text-center text-muted-foreground">
          © {new Date().getFullYear()} House-Shop Market. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
