{ pkgs ? import <nixpkgs> {} }:

let
  linuxFFmpeg = pkgs.stdenv.mkDerivation {
    name = "linux-ffmpeg-8.1.2-7";
    src = pkgs.fetchurl {
      url = "https://github.com/ErsatzTV/ErsatzTV-ffmpeg/releases/download/8.1.2-7/ffmpeg-n8.1.2-etv.7-linux64-gpl-8.1.tar.xz";
      sha256 = "sha256-7TLLX1xwZ0INOKZOILTK8WWXylcOPQ/wyQyOoyQHZ+c=";
    };
    installPhase = ''
      mkdir -p $out/bin
      find . -name 'ffmpeg' -executable -type f -exec cp {} $out/bin/ \;
      find . -name 'ffprobe' -executable -type f -exec cp {} $out/bin/ \;
    '';
  };
in

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_22
    (nodePackages.pnpm.override { nodejs = nodejs_22; })

    gcc
    gnumake
    python3

    sqlite
    git
    curl
    jq
  ]
  ++ pkgs.lib.optionals pkgs.stdenv.isLinux [ linuxFFmpeg ]
  ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [ pkgs.ffmpeg_8 ];

  shellHook = ''
    echo "Tunarr dev environment"
    echo "  node: $(node --version)"
    echo "  pnpm: $(pnpm --version 2>/dev/null)"
    echo "  ffmpeg: $(ffmpeg -version 2>&1 | head -1)"
  '';
}
