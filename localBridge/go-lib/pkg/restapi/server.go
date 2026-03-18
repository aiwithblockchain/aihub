package restapi

import (
	"fmt"
	"log"
	"net/http"

	"github.com/hyperorchid/localbridge/pkg/websocket"
)

type Server struct {
	port    int
	httpSrv *http.Server
}

func NewServer(port int, ws *websocket.Server) *Server {
	mux := http.NewServeMux()
	h := &Handler{ws: ws}
	h.Register(mux)
	return &Server{
		port:    port,
		httpSrv: &http.Server{Addr: fmt.Sprintf(":%d", port), Handler: mux},
	}
}

func (s *Server) Start() error {
	go func() {
		log.Printf("[REST] listening on :%d", s.port)
		if err := s.httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[REST] error: %v", err)
		}
	}()
	return nil
}

func (s *Server) Stop() {
	if s.httpSrv != nil {
		s.httpSrv.Close()
	}
}
