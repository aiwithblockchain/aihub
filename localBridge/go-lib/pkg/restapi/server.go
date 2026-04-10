package restapi

import (
	"fmt"
	"log"
	"net/http"

	"github.com/hyperorchid/localbridge/pkg/websocket"
)

type ListenAddress struct {
	IP      string
	Port    int
	Enabled bool
}

type Server struct {
	httpServers []*http.Server
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Client-Name, X-Instance-ID, Authorization")
		w.Header().Set("Access-Control-Max-Age", "600")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func NewServer(addresses []ListenAddress, ws *websocket.Server) *Server {
	h := NewHandler(ws)
	var servers []*http.Server

	seen := map[string]bool{}
	for _, addr := range addresses {
		if !addr.Enabled {
			continue
		}
		listenAddr := fmt.Sprintf("%s:%d", addr.IP, addr.Port)
		if seen[listenAddr] {
			continue
		}
		seen[listenAddr] = true

		mux := http.NewServeMux()
		h.Register(mux)
		servers = append(servers, &http.Server{Addr: listenAddr, Handler: withCORS(mux)})
	}

	return &Server{
		httpServers: servers,
	}
}

func (s *Server) Start() error {
	for _, srv := range s.httpServers {
		go func(server *http.Server) {
			log.Printf("[REST] listening on %s", server.Addr)
			if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Printf("[REST] error: %v", err)
			}
		}(srv)
	}
	return nil
}

func (s *Server) Stop() {
	for _, srv := range s.httpServers {
		if srv != nil {
			srv.Close()
		}
	}
}
