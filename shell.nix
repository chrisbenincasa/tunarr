{ pkgs ? import <nixpkgs> {} }:

let
  linuxFFmpeg = pkgs.stdenv.mkDerivation {
    name = "linux-ffmpeg-7.1.1";
    src = pkgs.fetchurl {
      url = "https://github.com/ErsatzTV/ErsatzTV-ffmpeg/releases/download/7.1.1/ffmpeg-n7.1.1-56-gc2184b65d2-linux64-gpl-7.1.tar.xz";
      sha256 = "sha256-/+JhogmWKZZCMQON1CgOzGQLnOzCNiU+5GLVpSMsPKw=";
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
    nodejs_24
    (nodePackages.pnpm.override { nodejs = nodejs_24; })

    gcc
    gnumake
    python3

    sqlite
    git
    curl
    jq
  ]
  ++ pkgs.lib.optionals pkgs.stdenv.isLinux [ linuxFFmpeg ]
  ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [ pkgs.ffmpeg_7 ];

  shellHook = ''
    echo "Tunarr dev environment"
    echo "  node: $(node --version)"
    echo "  pnpm: $(pnpm --version 2>/dev/null)"
    echo "  ffmpeg: $(ffmpeg -version 2>&1 | head -1)"
  '';
}
