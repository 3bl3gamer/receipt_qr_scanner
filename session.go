package main

import (
	"encoding/json"
	"io"
	"os"
	"strings"
	"time"

	"github.com/ansel1/merry"
)

var ErrSessionNotFound = merry.New("session not found")

type Session struct {
	RefreshToken string    `json:"refresh_token"`
	ClientSecret string    `json:"client_secret"`
	SessonID     string    `json:"sesson_id"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func writeSession(session *Session) error {
	configDir, err := MakeConfigDir()
	if err != nil {
		return merry.Wrap(err)
	}
	file, err := os.OpenFile(configDir+"/session.json", os.O_WRONLY|os.O_CREATE, 0600)
	if err != nil {
		return merry.Wrap(err)
	}
	defer file.Close()

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return merry.Wrap(err)
	}
	enc := json.NewEncoder(file)
	enc.SetIndent("", "\t")
	if err := enc.Encode(session); err != nil {
		return merry.Wrap(err)
	}
	offset, err := file.Seek(0, io.SeekCurrent)
	if err != nil {
		return merry.Wrap(err)
	}

	paddingLen := int(256 - offset)
	if paddingLen > 0 {
		if _, err := file.WriteString(strings.Repeat(" ", paddingLen)); err != nil {
			return merry.Wrap(err)
		}
	}
	return merry.Wrap(file.Close())
}

func readSession(session *Session) error {
	configDir, err := MakeConfigDir()
	if err != nil {
		return merry.Wrap(err)
	}
	file, err := os.Open(configDir + "/session.json")
	if os.IsNotExist(err) {
		return ErrSessionNotFound.Here()
	}
	if err != nil {
		return merry.Wrap(err)
	}
	defer file.Close()
	return merry.Wrap(json.NewDecoder(file).Decode(session))
}

func updateSession(session *Session) error {
	sessUpd, err := fnsRefreshSession(session.RefreshToken, session.ClientSecret)
	if err != nil {
		return merry.Wrap(err)
	}
	session.RefreshToken = sessUpd.RefreshToken
	session.SessonID = sessUpd.SessionID
	session.UpdatedAt = time.Now()
	return merry.Wrap(writeSession(session))
}

func updateSessionIfOld(session *Session) error {
	if time.Now().Sub(session.UpdatedAt) > 12*time.Hour {
		return merry.Wrap(updateSession(session))
	}
	return nil
}

func initSession(refreshToken, clientSecret string) (*Session, error) {
	session := &Session{RefreshToken: refreshToken, ClientSecret: clientSecret}
	if err := updateSession(session); err != nil {
		return nil, merry.Wrap(err)
	}
	return session, nil
}

func loadSession() (*Session, error) {
	session := &Session{}
	if err := readSession(session); err != nil {
		return nil, merry.Wrap(err)
	}
	return session, nil
}
